import {randomUUID} from "crypto";
import {initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {
  FieldValue,
  Timestamp,
  getFirestore,
} from "firebase-admin/firestore";
import {setGlobalOptions} from "firebase-functions/v2";
import {CallableOptions, onCall, HttpsError} from "firebase-functions/v2/https";

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
type CredentialApplicantType = "STUDENT" | "TEACHER" | "STAFF";

interface CredentialDocument {
  type: "photo" | "evidence";
  name: string;
  url: string;
  storagePath: string;
  contentType: string;
}

interface CreateCredentialRequestData {
  applicantType?: CredentialApplicantType;
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

type PrintBatchStatus = "CREATED" | "PRINTED";

interface CreatePrintBatchData {
  requestIds?: string[];
  note?: string;
}

interface MarkPrintBatchPrintedData {
  batchId?: string;
  note?: string;
}

interface VerifyCredentialData {
  token?: string;
}

type InstitutionalAcademicStatus =
  | "ACTIVE"
  | "WITHDRAWN"
  | "GRADUATED"
  | "SUSPENDED";

interface InstitutionalProfileImportRow {
  rowNumber?: number;
  email?: string;
  applicantType?: CredentialApplicantType;
  academicStatus?: InstitutionalAcademicStatus;
  studentId?: string;
  name?: string;
  career?: string;
  currentTerm?: string;
  position?: string;
}

interface ImportInstitutionalProfilesData {
  rows?: InstitutionalProfileImportRow[];
}

interface InstitutionalProfile {
  email: string;
  applicantType: CredentialApplicantType;
  academicStatus: InstitutionalAcademicStatus;
  studentId?: string;
  name: string;
  career?: string;
  currentTerm?: string;
  position?: string;
  active: boolean;
  source: "SAEKO";
  importedAt: Timestamp;
  updatedAt: Timestamp;
}

type UserRole = "admin" | "student";

interface StoredCredentialRequest {
  uid: string;
  applicantType?: CredentialApplicantType;
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
  verificationUrl?: string;
  printBatchId?: string;
  reviewedAt?: Timestamp;
  updatedAt?: Timestamp;
}

interface StoredPrintBatch {
  createdBy: string;
  requestIds: string[];
  status: PrintBatchStatus;
  total: number;
  note?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  printedAt?: Timestamp;
  printedBy?: string;
}

const db = getFirestore();
const adminAuth = getAuth();
const requests = db.collection("credential_requests");
const credentialCounters = db.collection("credential_counters");
const institutionalProfiles = db.collection("institutional_profiles");
const printBatches = db.collection("print_batches");
const institutionalEmailDomain = "tecplayacar.edu.mx";
const publicAppUrl = "https://credencial-tup.web.app";
const callableOptions: CallableOptions = {
  cors: [
    "https://credencial-tup.web.app",
    "https://credencial-tup.firebaseapp.com",
    "http://localhost:4200",
    "http://127.0.0.1:4200",
  ],
  invoker: "public",
};
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

export const createCredentialRequest = onCall(callableOptions, async (request) => {
  const auth = request.auth;

  if (!auth) {
    throw new HttpsError("unauthenticated", "Inicia sesión.");
  }

  const data = request.data as CreateCredentialRequestData;
  const email = auth.token.email || data.email || "";
  const normalizedEmail = normalizeEmail(email);
  const institutionalProfile = await getInstitutionalProfile(normalizedEmail);
  const input = validateCreateData(data, auth.uid, normalizedEmail, institutionalProfile);
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
        "El identificador ya tiene una solicitud activa para este periodo."
      );
    }

    const documents = input.evidence ?
      [input.photo, input.evidence] :
      [input.photo];

    const payload = {
      uid: auth.uid,
      applicantType: input.applicantType,
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
          note: `Solicitud enviada por ${applicantTypeLabel(input.applicantType)}.`,
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

export const syncUserSession = onCall(callableOptions, async (request) => {
  const auth = request.auth;

  if (!auth) {
    throw new HttpsError("unauthenticated", "Inicia sesión.");
  }

  const email = normalizeEmail(auth.token.email as string | undefined);

  if (!isInstitutionalEmail(email)) {
    throw new HttpsError(
      "permission-denied",
      "Solo se permiten cuentas institucionales."
    );
  }

  const role = resolveUserRole(email);
  const institutionalProfile = await getInstitutionalProfile(email);
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
  const profileName = institutionalProfile?.name ||
    resolveDisplayName(
      auth.token.name as string | undefined,
      userRecord.displayName,
      email
    );
  const profile = {
    uid: auth.uid,
    role,
    name: profileName,
    email,
    active: institutionalProfile ? institutionalProfile.active : true,
    applicantType: institutionalProfile?.applicantType || resolveApplicantTypeByEmail(email),
    academicStatus: institutionalProfile?.academicStatus || "ACTIVE",
    studentId: institutionalProfile?.studentId || "",
    career: institutionalProfile?.career || "",
    currentTerm: institutionalProfile?.currentTerm || "",
    position: institutionalProfile?.position || "",
    statusSource: institutionalProfile ? "SAEKO" : "EMAIL_PATTERN",
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

export const updateCredentialRequestStatus = onCall(callableOptions, async (request) => {
  const auth = request.auth;

  if (!auth) {
    throw new HttpsError("unauthenticated", "Inicia sesión.");
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
        "La transición de estatus no está permitida."
      );
    }

    if (status === "REJECTED" && !note) {
      throw new HttpsError(
        "invalid-argument",
        "El rechazo requiere un motivo."
      );
    }

    const credentialIdentity = status === "APPROVED_FOR_PRINT" ?
      await ensureCredentialIdentity(transaction, before, now) :
      null;
    const changes = buildStatusChanges(
      before,
      status,
      auth.uid,
      note,
      now,
      credentialIdentity
    );

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

export const createPrintBatch = onCall(callableOptions, async (request) => {
  const auth = request.auth;

  if (!auth) {
    throw new HttpsError("unauthenticated", "Inicia sesion.");
  }

  if (!isAdmin(auth.token)) {
    throw new HttpsError("permission-denied", "Requiere rol administrativo.");
  }

  const data = request.data as CreatePrintBatchData;
  const requestIds = requireRequestIds(data.requestIds);
  const note = typeof data.note === "string" ? data.note.trim() : "";
  const batchRef = printBatches.doc();
  const now = Timestamp.now();

  await db.runTransaction(async (transaction) => {
    const snapshots = await Promise.all(
      requestIds.map((requestId) => transaction.get(requests.doc(requestId)))
    );

    for (const snapshot of snapshots) {
      if (!snapshot.exists) {
        throw new HttpsError("not-found", "Una solicitud del lote no existe.");
      }

      const credential = snapshot.data() as StoredCredentialRequest;

      if (credential.status !== "APPROVED_FOR_PRINT") {
        throw new HttpsError(
          "failed-precondition",
          "Solo se pueden lotificar solicitudes aprobadas para impresion."
        );
      }

      if (credential.printBatchId) {
        throw new HttpsError(
          "already-exists",
          "Una solicitud seleccionada ya pertenece a otro lote."
        );
      }
    }

    const payload: StoredPrintBatch = {
      createdBy: auth.uid,
      requestIds,
      status: "CREATED",
      total: requestIds.length,
      note,
      createdAt: now,
      updatedAt: now,
    };

    transaction.set(batchRef, payload);

    for (const snapshot of snapshots) {
      transaction.update(snapshot.ref, {
        printBatchId: batchRef.id,
        updatedAt: now,
        timeline: FieldValue.arrayUnion({
          status: "APPROVED_FOR_PRINT",
          actorUid: auth.uid,
          note: `Solicitud agregada al lote ${batchRef.id}.`,
          timestamp: now,
        }),
      });
    }

    writeAudit(
      transaction,
      auth.uid,
      "print_batch.create",
      batchRef.id,
      null,
      payload,
      "print_batches"
    );
  });

  return {batchId: batchRef.id};
});

export const markPrintBatchPrinted = onCall(callableOptions, async (request) => {
  const auth = request.auth;

  if (!auth) {
    throw new HttpsError("unauthenticated", "Inicia sesion.");
  }

  if (!isAdmin(auth.token)) {
    throw new HttpsError("permission-denied", "Requiere rol administrativo.");
  }

  const data = request.data as MarkPrintBatchPrintedData;
  const batchId = requireString(data.batchId, "batchId");
  const note = typeof data.note === "string" && data.note.trim() ?
    data.note.trim() :
    `Credencial impresa en lote ${batchId}.`;
  const batchRef = printBatches.doc(batchId);
  const now = Timestamp.now();

  await db.runTransaction(async (transaction) => {
    const batchSnapshot = await transaction.get(batchRef);

    if (!batchSnapshot.exists) {
      throw new HttpsError("not-found", "El lote no existe.");
    }

    const printBatch = batchSnapshot.data() as StoredPrintBatch;

    if (printBatch.status === "PRINTED") {
      throw new HttpsError("failed-precondition", "El lote ya fue marcado como impreso.");
    }

    const requestIds = requireRequestIds(printBatch.requestIds);
    const snapshots = await Promise.all(
      requestIds.map((requestId) => transaction.get(requests.doc(requestId)))
    );

    for (const snapshot of snapshots) {
      if (!snapshot.exists) {
        throw new HttpsError("not-found", "Una solicitud del lote no existe.");
      }

      const credential = snapshot.data() as StoredCredentialRequest;

      if (
        credential.status !== "APPROVED_FOR_PRINT" &&
        credential.status !== "PRINTED"
      ) {
        throw new HttpsError(
          "failed-precondition",
          "El lote contiene solicitudes que ya no estan listas para imprimir."
        );
      }
    }

    for (const snapshot of snapshots) {
      const before = snapshot.data() as StoredCredentialRequest;

      if (before.status === "PRINTED") {
        continue;
      }

      const changes = buildStatusChanges(
        before,
        "PRINTED",
        auth.uid,
        note,
        now,
        null
      );

      changes.printBatchId = batchId;
      transaction.update(snapshot.ref, changes);
      writeAudit(
        transaction,
        auth.uid,
        "credential_request.batch_printed",
        snapshot.id,
        before,
        buildAuditAfter(before, changes)
      );
      queueStatusNotification(transaction, snapshot.id, before, "PRINTED", note, now);
    }

    transaction.update(batchRef, {
      status: "PRINTED",
      printedAt: now,
      printedBy: auth.uid,
      updatedAt: now,
    });
    writeAudit(
      transaction,
      auth.uid,
      "print_batch.printed",
      batchId,
      printBatch,
      {
        ...printBatch,
        status: "PRINTED",
        printedAt: now,
        printedBy: auth.uid,
        updatedAt: now,
      },
      "print_batches"
    );
  });

  return {ok: true};
});

export const verifyCredential = onCall(callableOptions, async (request) => {
  const data = request.data as VerifyCredentialData;
  const token = requireString(data.token, "token");

  if (!/^[a-f0-9-]{20,}$/i.test(token)) {
    throw new HttpsError("invalid-argument", "Token de verificación inválido.");
  }

  const snapshot = await requests.where("qrToken", "==", token).limit(1).get();

  if (snapshot.empty) {
    return {
      valid: false,
      message: "No encontramos una credencial asociada a este QR.",
    };
  }

  const credential = snapshot.docs[0].data() as StoredCredentialRequest;
  const profile = await getInstitutionalProfile(credential.email);
  const validStatuses: CredentialRequestStatus[] = [
    "APPROVED_FOR_PRINT",
    "PRINTED",
    "READY_FOR_PICKUP",
    "DELIVERED",
  ];
  const valid =
    validStatuses.includes(credential.status) &&
    (!profile || profile.academicStatus === "ACTIVE");

  return {
    valid,
    message: valid ?
      "Credencial institucional válida." :
      "La credencial no se encuentra vigente para verificación.",
    status: credential.status,
    credentialNumber: credential.credentialNumber || "",
    applicantType: credential.applicantType || "STUDENT",
    name: credential.name,
    career: credential.applicantType === "TEACHER" ? "Docente" : credential.career,
    cycle: credential.applicantType === "STUDENT" || !credential.applicantType ?
      credential.cycle :
      "",
    verifiedAt: new Date().toISOString(),
  };
});

export const importInstitutionalProfiles = onCall(callableOptions, async (request) => {
  const auth = request.auth;

  if (!auth) {
    throw new HttpsError("unauthenticated", "Inicia sesion.");
  }

  if (!isAdmin(auth.token)) {
    throw new HttpsError("permission-denied", "Requiere rol administrativo.");
  }

  const data = request.data as ImportInstitutionalProfilesData;
  const rows = Array.isArray(data.rows) ? data.rows : [];

  if (!rows.length) {
    throw new HttpsError("invalid-argument", "El archivo no contiene registros.");
  }

  if (rows.length > 3000) {
    throw new HttpsError(
      "invalid-argument",
      "Importa un maximo de 3000 registros por archivo."
    );
  }

  const now = Timestamp.now();
  const profiles = rows.map((row, index) => validateInstitutionalProfileRow(row, index, now));
  let batch = db.batch();
  let pendingWrites = 0;
  let imported = 0;

  for (const profile of profiles) {
    batch.set(institutionalProfiles.doc(profile.email), profile, {merge: true});
    pendingWrites++;
    imported++;

    if (pendingWrites >= 450) {
      await batch.commit();
      batch = db.batch();
      pendingWrites = 0;
    }
  }

  batch.set(db.collection("audit_logs").doc(), {
    actorUid: auth.uid,
    action: "institutional_profiles.import",
    entity: "institutional_profiles",
    entityId: "saeko-import",
    before: null,
    after: {
      imported,
      total: rows.length,
      source: "SAEKO",
    },
    timestamp: now,
  });

  await batch.commit();

  return {
    ok: true,
    imported,
    total: rows.length,
  };
});

function validateCreateData(
  data: CreateCredentialRequestData,
  uid: string,
  email: string,
  profile: InstitutionalProfile | null
) {
  const normalizedEmail = normalizeEmail(email);
  const applicantType = resolveApplicantTypeByEmail(normalizedEmail);
  const profileApplicantType = profile?.applicantType || applicantType;

  if (profile && profile.academicStatus !== "ACTIVE") {
    const statusLabel = academicStatusLabel(profile.academicStatus);

    throw new HttpsError(
      "failed-precondition",
      `Tu perfil institucional aparece como ${statusLabel}. ` +
        "Contacta a Control Escolar."
    );
  }

  const requestType = requireRequestType(data.requestType);
  const photo = validateDocument(data.photo, "photo", uid);
  const evidence = requestType === "REPLACEMENT" ?
    validateDocument(data.evidence, "evidence", uid) :
    null;
  const isStudent = profileApplicantType === "STUDENT";
  const isStaff = profileApplicantType === "STAFF";

  return {
    applicantType: profileApplicantType,
    requestType,
    email: normalizedEmail,
    studentId: isStudent ?
      (profile?.studentId || requireString(data.studentId, "studentId")).toUpperCase() :
      buildNonStudentIdentifier(normalizedEmail, uid),
    name: profile?.name || requireString(data.name, "name"),
    career: isStudent ?
      profile?.career || requireString(data.career, "career") :
      isStaff ?
        profile?.position || profile?.career || requireString(data.career, "career") :
        "Docente",
    cycle: isStudent ? profile?.currentTerm || requireString(data.cycle, "cycle") : "No aplica",
    phone: isStudent ? requireString(data.phone, "phone") : "No aplica",
    photo,
    evidence,
  };
}

function validateInstitutionalProfileRow(
  row: InstitutionalProfileImportRow,
  index: number,
  now: Timestamp
): InstitutionalProfile {
  const rowNumber = row.rowNumber || index + 2;
  const email = normalizeEmail(row.email);
  const applicantType = requireApplicantType(row.applicantType, email, rowNumber);
  const academicStatus = requireAcademicStatus(row.academicStatus, rowNumber);
  const isStudent = applicantType === "STUDENT";
  const isStaff = applicantType === "STAFF";
  const position = cleanOptionalString(row.position || row.career);
  const profile: InstitutionalProfile = {
    email,
    applicantType,
    academicStatus,
    name: requireString(row.name, `nombre fila ${rowNumber}`),
    active: academicStatus === "ACTIVE",
    source: "SAEKO",
    importedAt: now,
    updatedAt: now,
  };

  if (isStudent) {
    profile.studentId = requireString(row.studentId, `matricula fila ${rowNumber}`).toUpperCase();
    profile.career = requireString(row.career, `programa fila ${rowNumber}`);
    profile.currentTerm = requireString(row.currentTerm, `cuatrimestre fila ${rowNumber}`);
  } else if (isStaff) {
    profile.position = requireString(position, `puesto fila ${rowNumber}`);
    profile.career = profile.position;
  } else {
    profile.position = "Docente";
    profile.career = "Docente";
  }

  return profile;
}

async function getInstitutionalProfile(email: string): Promise<InstitutionalProfile | null> {
  const normalizedEmail = normalizeEmail(email);
  const snapshot = await institutionalProfiles.doc(normalizedEmail).get();

  if (!snapshot.exists) {
    return null;
  }

  return snapshot.data() as InstitutionalProfile;
}

function requireApplicantType(
  value: unknown,
  email: string,
  rowNumber: number
): CredentialApplicantType {
  if (value === "STUDENT" || value === "TEACHER" || value === "STAFF") {
    return value;
  }

  const resolved = resolveApplicantTypeByEmail(email);

  if (resolved) {
    return resolved;
  }

  throw new HttpsError("invalid-argument", `Tipo de solicitante invalido en fila ${rowNumber}.`);
}

function requireAcademicStatus(value: unknown, rowNumber: number): InstitutionalAcademicStatus {
  if (
    value === "ACTIVE" ||
    value === "WITHDRAWN" ||
    value === "GRADUATED" ||
    value === "SUSPENDED"
  ) {
    return value;
  }

  throw new HttpsError("invalid-argument", `Estatus institucional invalido en fila ${rowNumber}.`);
}

function cleanOptionalString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function academicStatusLabel(status: InstitutionalAcademicStatus): string {
  const labels: Record<InstitutionalAcademicStatus, string> = {
    ACTIVE: "activo",
    WITHDRAWN: "baja",
    GRADUATED: "egresado",
    SUSPENDED: "suspendido",
  };

  return labels[status];
}

function validateDocument(
  document: CredentialDocument | undefined,
  type: CredentialDocument["type"],
  uid: string
): CredentialDocument {
  if (!document || document.type !== type) {
    throw new HttpsError("invalid-argument", `Documento ${type} inválido.`);
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
  now: Timestamp,
  credentialIdentity?: {
    credentialNumber: string;
    qrToken: string;
    verificationUrl: string;
  } | null
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
    const identity = credentialIdentity || {
      credentialNumber: before.credentialNumber || buildCredentialNumber(before, now),
      qrToken: before.qrToken || randomUUID(),
      verificationUrl: before.verificationUrl || "",
    };

    changes.credentialNumber = identity.credentialNumber;
    changes.qrToken = identity.qrToken;
    changes.verificationUrl = identity.verificationUrl || buildVerificationUrl(identity.qrToken);
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

async function ensureCredentialIdentity(
  transaction: FirebaseFirestore.Transaction,
  request: StoredCredentialRequest,
  now: Timestamp
) {
  const year = now.toDate().getFullYear();
  const prefix = credentialPrefix(request.applicantType);
  const qrToken = request.qrToken || randomUUID();
  let credentialNumber = request.credentialNumber;

  if (!credentialNumber) {
    const counterRef = credentialCounters.doc(`${year}-${prefix}`);
    const counterSnapshot = await transaction.get(counterRef);
    const counterData = counterSnapshot.exists ? counterSnapshot.data() : null;
    const nextValue = typeof counterData?.nextValue === "number" ?
      counterData.nextValue :
      1;

    credentialNumber = buildCredentialNumber(prefix, year, nextValue);

    transaction.set(counterRef, {
      prefix,
      year,
      nextValue: nextValue + 1,
      updatedAt: now,
    }, {merge: true});
  }

  return {
    credentialNumber,
    qrToken,
    verificationUrl: buildVerificationUrl(qrToken),
  };
}

function buildCredentialNumber(
  prefixOrRequest: string | StoredCredentialRequest,
  yearOrNow: number | Timestamp,
  sequence?: number
): string {
  if (typeof prefixOrRequest === "string" && typeof yearOrNow === "number") {
    return `TUP-${prefixOrRequest}-${yearOrNow}-${String(sequence || 1).padStart(5, "0")}`;
  }

  const request = prefixOrRequest as StoredCredentialRequest;
  const now = yearOrNow as Timestamp;
  const year = now.toDate().getFullYear();
  const prefix = credentialPrefix(request.applicantType);

  return `TUP-${prefix}-${year}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function credentialPrefix(type: CredentialApplicantType | undefined): string {
  if (type === "TEACHER") {
    return "DOC";
  }

  if (type === "STAFF") {
    return "COL";
  }

  return "EST";
}

function buildVerificationUrl(token: string): string {
  return `${publicAppUrl}/verify/${encodeURIComponent(token)}`;
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
      applicantType: request.applicantType || "STUDENT",
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
    REJECTED: "Tu solicitud de credencial requiere corrección",
    APPROVED_FOR_PRINT: "Tu credencial fue aprobada para impresión",
    PRINTED: "Tu credencial ya fue impresa",
    READY_FOR_PICKUP: "Tu credencial está lista para entrega",
    DELIVERED: "Entrega de credencial confirmada",
  };

  return subjects[status] || "Actualización de solicitud de credencial";
}

function notificationText(
  status: CredentialRequestStatus,
  request: StoredCredentialRequest,
  note: string
): string {
  const base = `Hola ${request.name},\n\n`;
  const footer = "\n\nTecnológico Universitario Playacar";

  if (status === "REJECTED") {
    return `${base}Tu solicitud fue rechazada. Motivo: ${note}.${footer}`;
  }

  if (status === "APPROVED_FOR_PRINT") {
    return `${base}Tu solicitud fue aprobada para impresión.${footer}`;
  }

  if (status === "PRINTED") {
    return `${base}Tu credencial ya fue impresa.${footer}`;
  }

  if (status === "READY_FOR_PICKUP") {
    return `${base}Tu credencial está lista para entrega.${footer}`;
  }

  if (status === "DELIVERED") {
    return `${base}Confirmamos la entrega de tu credencial.${footer}`;
  }

  return `${base}Tu solicitud cambió de estatus.${footer}`;
}

function writeAudit(
  transaction: FirebaseFirestore.Transaction,
  actorUid: string,
  action: string,
  entityId: string,
  before: unknown,
  after: unknown,
  entity = "credential_requests"
) {
  transaction.set(db.collection("audit_logs").doc(), {
    actorUid,
    action,
    entity,
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
    throw new HttpsError("invalid-argument", "Estatus inválido.");
  }

  return value as CredentialRequestStatus;
}

function requireRequestIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new HttpsError("invalid-argument", "Selecciona al menos una solicitud.");
  }

  const requestIds = Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );

  if (!requestIds.length) {
    throw new HttpsError("invalid-argument", "Selecciona al menos una solicitud.");
  }

  if (requestIds.length > 100) {
    throw new HttpsError("invalid-argument", "El lote no puede superar 100 solicitudes.");
  }

  return requestIds;
}

function requireRequestType(value: unknown): CredentialRequestType {
  if (value === "FIRST_TIME" || value === "REPLACEMENT") {
    return value;
  }

  throw new HttpsError("invalid-argument", "Tipo de trámite inválido.");
}

function buildNonStudentIdentifier(email: string, uid: string): string {
  return (email.split("@")[0] || uid).toUpperCase();
}

function resolveApplicantTypeByEmail(email: string): CredentialApplicantType {
  const account = email.split("@")[0] || "";

  if (/^tup-d\d{4,}$/.test(account)) {
    return "TEACHER";
  }

  if (/^tup\d{4,}$/.test(account)) {
    return "STUDENT";
  }

  return "STAFF";
}

function applicantTypeLabel(type: CredentialApplicantType): string {
  if (type === "TEACHER") {
    return "docente";
  }

  if (type === "STAFF") {
    return "colaborador";
  }

  return "estudiante";
}

function normalizeEmail(email: string | undefined): string {
  const clean = (email || "").trim().toLowerCase();

  if (!clean || !clean.includes("@")) {
    throw new HttpsError("invalid-argument", "Correo inválido.");
  }

  return clean;
}
