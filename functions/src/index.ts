import {randomUUID} from "crypto";
import {initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {
  FieldValue,
  Timestamp,
  getFirestore,
} from "firebase-admin/firestore";
import {setGlobalOptions} from "firebase-functions/v2";
import {onCall, HttpsError} from "firebase-functions/v2/https";

initializeApp();
setGlobalOptions({region: "us-central1"});

type CredentialRequestStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "REJECTED"
  | "APPROVED_FOR_PRINT"
  | "PRINTED"
  | "READY_FOR_PICKUP"
  | "DELIVERED";

type CredentialRequestType = "FIRST_TIME" | "REPLACEMENT";

interface CredentialDocument {
  type: "photo" | "evidence";
  name: string;
  url: string;
  storagePath: string;
  contentType: string;
}

interface CreateCredentialRequestData {
  requestType?: CredentialRequestType;
  email?: string;
  studentId?: string;
  name?: string;
  career?: string;
  cycle?: string;
  phone?: string;
  photo?: CredentialDocument;
  evidence?: CredentialDocument;
}

interface UpdateStatusData {
  requestId?: string;
  status?: CredentialRequestStatus;
  note?: string;
}

type UserRole = "admin" | "student";

interface StoredCredentialRequest {
  uid: string;
  requestType?: CredentialRequestType;
  email: string;
  studentId: string;
  name: string;
  career: string;
  cycle: string;
  phone: string;
  status: CredentialRequestStatus;
  credentialNumber?: string;
  qrToken?: string;
}

const db = getFirestore();
const adminAuth = getAuth();
const requests = db.collection("credential_requests");
const institutionalEmailDomain = "tecplayacar.edu.mx";
const adminEmails = new Set([
  "victor.yama@tecplayacar.edu.mx",
  "omar.sanchez@tecplayacar.edu.mx",
  "lizett.mendez@tecplayacar.edu.mx",
]);

const allowedTransitions: Record<
  CredentialRequestStatus,
  CredentialRequestStatus[]
> = {
  SUBMITTED: ["UNDER_REVIEW", "REJECTED"],
  UNDER_REVIEW: ["APPROVED_FOR_PRINT", "REJECTED"],
  REJECTED: ["UNDER_REVIEW"],
  APPROVED_FOR_PRINT: ["PRINTED"],
  PRINTED: ["READY_FOR_PICKUP"],
  READY_FOR_PICKUP: ["DELIVERED"],
  DELIVERED: [],
};

const activeStatuses: CredentialRequestStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED_FOR_PRINT",
  "PRINTED",
  "READY_FOR_PICKUP",
];

export const createCredentialRequest = onCall(async (request) => {
  const auth = request.auth;

  if (!auth) {
    throw new HttpsError("unauthenticated", "Inicia sesion.");
  }

  const data = request.data as CreateCredentialRequestData;
  const email = auth.token.email || data.email || "";
  const input = validateCreateData(data, auth.uid, email);
  const now = Timestamp.now();
  const requestRef = requests.doc();

  await db.runTransaction(async (transaction) => {
    const sameUserCycle = await transaction.get(
      requests
        .where("uid", "==", auth.uid)
        .where("cycle", "==", input.cycle)
    );
    const sameUser = await transaction.get(
      requests.where("uid", "==", auth.uid)
    );
    const sameStudentCycle = await transaction.get(
      requests
        .where("studentId", "==", input.studentId)
        .where("cycle", "==", input.cycle)
    );
    const sameStudent = await transaction.get(
      requests.where("studentId", "==", input.studentId)
    );

    if (
      input.requestType === "FIRST_TIME" &&
      (hasFirstTimeRequest(sameUser.docs) ||
        hasFirstTimeRequest(sameStudent.docs))
    ) {
      throw new HttpsError(
        "already-exists",
        "La credencial por primera vez solo puede solicitarse una vez."
      );
    }

    if (hasActiveRequest(sameUserCycle.docs)) {
      throw new HttpsError(
        "already-exists",
        "Ya tienes una solicitud activa para este cuatrimestre."
      );
    }

    if (hasActiveRequest(sameStudentCycle.docs)) {
      throw new HttpsError(
        "already-exists",
        "La matricula ya tiene una solicitud activa para este cuatrimestre."
      );
    }

    const documents = input.evidence ?
      [input.photo, input.evidence] :
      [input.photo];

    const payload = {
      uid: auth.uid,
      requestType: input.requestType,
      email: input.email,
      studentId: input.studentId,
      name: input.name,
      career: input.career,
      cycle: input.cycle,
      phone: input.phone,
      status: "SUBMITTED",
      photoUrl: input.photo.url,
      documents,
      timeline: [
        {
          status: "SUBMITTED",
          actorUid: auth.uid,
          note: "Solicitud enviada por estudiante.",
          timestamp: now,
        },
      ],
      submittedAt: now,
      updatedAt: now,
    };

    transaction.set(requestRef, payload);
    writeAudit(transaction, auth.uid, "credential_request.create", requestRef.id, null, payload);
  });

  return {requestId: requestRef.id};
});

export const syncUserSession = onCall(async (request) => {
  const auth = request.auth;

  if (!auth) {
    throw new HttpsError("unauthenticated", "Inicia sesion.");
  }

  const email = normalizeEmail(auth.token.email as string | undefined);

  if (!isInstitutionalEmail(email)) {
    throw new HttpsError(
      "permission-denied",
      "Solo se permiten cuentas institucionales."
    );
  }

  const role = resolveUserRole(email);
  const userRecord = await adminAuth.getUser(auth.uid);
  const customClaims = userRecord.customClaims || {};
  const nextClaims = {
    ...customClaims,
    role,
    admin: role === "admin",
  };

  if (
    customClaims.role !== nextClaims.role ||
    customClaims.admin !== nextClaims.admin
  ) {
    await adminAuth.setCustomUserClaims(auth.uid, nextClaims);
  }

  const userRef = db.collection("users").doc(auth.uid);
  const userSnapshot = await userRef.get();
  const now = Timestamp.now();
  const profile = {
    uid: auth.uid,
    role,
    name: resolveDisplayName(
      auth.token.name as string | undefined,
      userRecord.displayName,
      email
    ),
    email,
    active: true,
    updatedAt: now,
  };

  if (userSnapshot.exists) {
    await userRef.set(profile, {merge: true});
  } else {
    await userRef.set({
      ...profile,
      createdAt: now,
    });
  }

  return {role};
});

export const updateCredentialRequestStatus = onCall(async (request) => {
  const auth = request.auth;

  if (!auth) {
    throw new HttpsError("unauthenticated", "Inicia sesion.");
  }

  if (!isAdmin(auth.token)) {
    throw new HttpsError("permission-denied", "Requiere rol administrativo.");
  }

  const data = request.data as UpdateStatusData;
  const requestId = requireString(data.requestId, "requestId");
  const status = requireStatus(data.status);
  const note = typeof data.note === "string" ? data.note.trim() : "";
  const requestRef = requests.doc(requestId);
  const now = Timestamp.now();

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(requestRef);

    if (!snapshot.exists) {
      throw new HttpsError("not-found", "La solicitud no existe.");
    }

    const before = snapshot.data() as StoredCredentialRequest;

    if (!allowedTransitions[before.status]?.includes(status)) {
      throw new HttpsError(
        "failed-precondition",
        "La transicion de estatus no esta permitida."
      );
    }

    if (status === "REJECTED" && !note) {
      throw new HttpsError(
        "invalid-argument",
        "El rechazo requiere un motivo."
      );
    }

    const changes = buildStatusChanges(before, status, auth.uid, note, now);

    transaction.update(requestRef, changes);
    writeAudit(
      transaction,
      auth.uid,
      "credential_request.status_changed",
      requestRef.id,
      before,
      buildAuditAfter(before, changes)
    );
    queueStatusNotification(transaction, requestRef.id, before, status, note, now);
  });

  return {ok: true};
});

function validateCreateData(
  data: CreateCredentialRequestData,
  uid: string,
  email: string
) {
  const requestType = requireRequestType(data.requestType);
  const photo = validateDocument(data.photo, "photo", uid);
  const evidence = requestType === "REPLACEMENT" ?
    validateDocument(data.evidence, "evidence", uid) :
    null;

  return {
    requestType,
    email: normalizeEmail(email),
    studentId: requireString(data.studentId, "studentId").toUpperCase(),
    name: requireString(data.name, "name"),
    career: requireString(data.career, "career"),
    cycle: requireString(data.cycle, "cycle"),
    phone: requireString(data.phone, "phone"),
    photo,
    evidence,
  };
}

function validateDocument(
  document: CredentialDocument | undefined,
  type: CredentialDocument["type"],
  uid: string
): CredentialDocument {
  if (!document || document.type !== type) {
    throw new HttpsError("invalid-argument", `Documento ${type} invalido.`);
  }

  if (!document.storagePath.startsWith(`credential-requests/${uid}/`)) {
    throw new HttpsError("permission-denied", "Ruta de archivo no permitida.");
  }

  if (!document.url || !document.name || !document.contentType) {
    throw new HttpsError("invalid-argument", `Documento ${type} incompleto.`);
  }

  return document;
}

function buildStatusChanges(
  before: StoredCredentialRequest,
  status: CredentialRequestStatus,
  actorUid: string,
  note: string,
  now: Timestamp
) {
  const changes: Record<string, unknown> = {
    status,
    updatedAt: now,
    timeline: FieldValue.arrayUnion({
      status,
      actorUid,
      note,
      timestamp: now,
    }),
  };

  if (["UNDER_REVIEW", "APPROVED_FOR_PRINT", "REJECTED"].includes(status)) {
    changes.reviewedAt = now;
    changes.reviewNotes = note;
  }

  if (status === "REJECTED") {
    changes.rejectionReason = note;
  }

  if (status === "APPROVED_FOR_PRINT") {
    changes.credentialNumber =
      before.credentialNumber || buildCredentialNumber(before, now);
    changes.qrToken = before.qrToken || randomUUID();
  }

  if (status === "PRINTED") {
    changes.printedAt = now;
  }

  if (status === "READY_FOR_PICKUP") {
    changes.readyForPickupAt = now;
  }

  if (status === "DELIVERED") {
    changes.deliveredAt = now;
  }

  return changes;
}

function buildCredentialNumber(
  request: StoredCredentialRequest,
  now: Timestamp
): string {
  const cycle = request.cycle.replace(/[^A-Z0-9-]/gi, "").toUpperCase();
  const year = now.toDate().getFullYear();
  const suffix = randomUUID().slice(0, 8).toUpperCase();

  return `CR-${cycle || year}-${suffix}`;
}

function queueStatusNotification(
  transaction: FirebaseFirestore.Transaction,
  requestId: string,
  request: StoredCredentialRequest,
  status: CredentialRequestStatus,
  note: string,
  now: Timestamp
) {
  const template = notificationTemplate(status);

  if (!template) {
    return;
  }

  const notificationRef = db.collection("notifications").doc();
  const mailRef = db.collection("mail").doc(notificationRef.id);
  const subject = notificationSubject(status);
  const text = notificationText(status, request, note);
  const notification = {
    uid: request.uid,
    type: "EMAIL",
    template,
    payload: {
      requestId,
      to: request.email,
      subject,
      text,
      status,
      studentId: request.studentId,
    },
    status: "PENDING",
    createdAt: now,
    sentAt: null,
  };

  transaction.set(notificationRef, notification);
  transaction.set(mailRef, {
    to: [request.email],
    message: {
      subject,
      text,
    },
    createdAt: now,
    notificationId: notificationRef.id,
  });
}

function notificationTemplate(status: CredentialRequestStatus): string | null {
  const templates: Partial<Record<CredentialRequestStatus, string>> = {
    REJECTED: "credential_rejected",
    APPROVED_FOR_PRINT: "credential_approved_for_print",
    PRINTED: "credential_printed",
    READY_FOR_PICKUP: "credential_ready_for_pickup",
    DELIVERED: "credential_delivered",
  };

  return templates[status] || null;
}

function notificationSubject(status: CredentialRequestStatus): string {
  const subjects: Partial<Record<CredentialRequestStatus, string>> = {
    REJECTED: "Tu solicitud de credencial requiere correccion",
    APPROVED_FOR_PRINT: "Tu credencial fue aprobada para impresion",
    PRINTED: "Tu credencial ya fue impresa",
    READY_FOR_PICKUP: "Tu credencial esta lista para entrega",
    DELIVERED: "Entrega de credencial confirmada",
  };

  return subjects[status] || "Actualizacion de solicitud de credencial";
}

function notificationText(
  status: CredentialRequestStatus,
  request: StoredCredentialRequest,
  note: string
): string {
  const base = `Hola ${request.name},\n\n`;
  const footer = "\n\nTecnologico Universitario Playacar";

  if (status === "REJECTED") {
    return `${base}Tu solicitud fue rechazada. Motivo: ${note}.${footer}`;
  }

  if (status === "APPROVED_FOR_PRINT") {
    return `${base}Tu solicitud fue aprobada para impresion.${footer}`;
  }

  if (status === "PRINTED") {
    return `${base}Tu credencial ya fue impresa.${footer}`;
  }

  if (status === "READY_FOR_PICKUP") {
    return `${base}Tu credencial esta lista para entrega.${footer}`;
  }

  if (status === "DELIVERED") {
    return `${base}Confirmamos la entrega de tu credencial.${footer}`;
  }

  return `${base}Tu solicitud cambio de estatus.${footer}`;
}

function writeAudit(
  transaction: FirebaseFirestore.Transaction,
  actorUid: string,
  action: string,
  entityId: string,
  before: unknown,
  after: unknown
) {
  transaction.set(db.collection("audit_logs").doc(), {
    actorUid,
    action,
    entity: "credential_requests",
    entityId,
    before,
    after,
    timestamp: FieldValue.serverTimestamp(),
  });
}

function buildAuditAfter(
  before: StoredCredentialRequest,
  changes: Record<string, unknown>
) {
  const plainChanges = {...changes};

  delete plainChanges.timeline;

  return {
    ...before,
    ...plainChanges,
  };
}

function hasActiveRequest(
  docs: FirebaseFirestore.QueryDocumentSnapshot[]
): boolean {
  return docs.some((doc) => {
    const data = doc.data() as StoredCredentialRequest;

    return activeStatuses.includes(data.status);
  });
}

function hasFirstTimeRequest(
  docs: FirebaseFirestore.QueryDocumentSnapshot[]
): boolean {
  return docs.some((doc) => {
    const data = doc.data() as StoredCredentialRequest;

    return !data.requestType || data.requestType === "FIRST_TIME";
  });
}

function isAdmin(token: Record<string, unknown>): boolean {
  return token.admin === true || token.role === "admin" || token.role === "ADMIN";
}

function isInstitutionalEmail(email: string): boolean {
  return !!email && email.endsWith(`@${institutionalEmailDomain}`);
}

function resolveUserRole(email: string): UserRole {
  return adminEmails.has(email) ? "admin" : "student";
}

function resolveDisplayName(
  tokenName: string | undefined,
  userName: string | null | undefined,
  email: string
): string {
  const baseName = tokenName?.trim() || userName?.trim();

  if (baseName) {
    return baseName;
  }

  return email
    .split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpsError("invalid-argument", `Campo requerido: ${field}.`);
  }

  return value.trim();
}

function requireStatus(value: unknown): CredentialRequestStatus {
  const statuses = Object.keys(allowedTransitions);

  if (typeof value !== "string" || !statuses.includes(value)) {
    throw new HttpsError("invalid-argument", "Estatus invalido.");
  }

  return value as CredentialRequestStatus;
}

function requireRequestType(value: unknown): CredentialRequestType {
  if (value === "FIRST_TIME" || value === "REPLACEMENT") {
    return value;
  }

  throw new HttpsError("invalid-argument", "Tipo de tramite invalido.");
}

function normalizeEmail(email: string | undefined): string {
  const clean = (email || "").trim().toLowerCase();

  if (!clean || !clean.includes("@")) {
    throw new HttpsError("invalid-argument", "Correo invalido.");
  }

  return clean;
}
