import { Injectable } from '@angular/core';

export interface ImageCompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
}

@Injectable({
  providedIn: 'root',
})
export class ImageCompressionService {
  private readonly maxDimension = 1200;
  private readonly initialQuality = 0.86;
  private readonly minQuality = 0.74;
  private readonly qualityStep = 0.04;
  private readonly targetBytes = 900 * 1024;

  async compressCredentialPhoto(file: File): Promise<ImageCompressionResult> {
    const sourceUrl = URL.createObjectURL(file);

    try {
      const image = await this.loadImage(sourceUrl);
      const { width, height } = this.scaledDimensions(
        image.naturalWidth,
        image.naturalHeight
      );
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!context || width <= 0 || height <= 0) {
        throw new Error('No fue posible procesar la imagen.');
      }

      canvas.width = width;
      canvas.height = height;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      let quality = this.initialQuality;
      let blob = await this.toJpegBlob(canvas, quality);

      while (blob.size > this.targetBytes && quality > this.minQuality) {
        quality = Math.max(this.minQuality, quality - this.qualityStep);
        blob = await this.toJpegBlob(canvas, quality);
      }

      return {
        file: new File([blob], this.jpegName(file.name), {
          type: 'image/jpeg',
          lastModified: Date.now(),
        }),
        originalSize: file.size,
        compressedSize: blob.size,
      };
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  }

  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();

      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('No fue posible leer la imagen.'));
      image.src = url;
    });
  }

  private scaledDimensions(width: number, height: number): { width: number; height: number } {
    const largestSide = Math.max(width, height);

    if (largestSide <= this.maxDimension) {
      return { width, height };
    }

    const scale = this.maxDimension / largestSide;

    return {
      width: Math.round(width * scale),
      height: Math.round(height * scale),
    };
  }

  private toJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('No fue posible comprimir la imagen.'));
            return;
          }

          resolve(blob);
        },
        'image/jpeg',
        quality
      );
    });
  }

  private jpegName(fileName: string): string {
    const cleanName = fileName.trim() || 'foto-credencial';
    const withoutExtension = cleanName.replace(/\.[^.]+$/, '');

    return `${withoutExtension}.jpg`;
  }
}
