import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, normalize, relative, resolve } from 'node:path';

type UploadBufferInput = {
  tenantId: string;
  exportJobId: string;
  filename: string;
  buffer: Buffer;
};

@Injectable()
export class StorageService {
  private readonly bucket = process.env.STORAGE_BUCKET || 'process-discovery-exports';
  private readonly root = resolve(process.env.STORAGE_LOCAL_PATH || join(process.cwd(), 'storage'));

  async uploadBuffer(input: UploadBufferInput) {
    const objectKey = this.objectKey(input);
    const absolutePath = this.absolutePath(objectKey);

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.buffer);

    return {
      storageProvider: 'local',
      bucket: this.bucket,
      objectKey,
      size: BigInt(input.buffer.length),
      checksum: createHash('sha256').update(input.buffer).digest('hex'),
    };
  }

  async readObject(objectKey: string | null | undefined) {
    if (!objectKey) throw new NotFoundException('Objet introuvable.');
    try {
      return await readFile(this.absolutePath(objectKey));
    } catch {
      throw new NotFoundException('Objet introuvable.');
    }
  }

  private objectKey(input: UploadBufferInput) {
    const filename = input.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return normalize(join('tenants', input.tenantId, 'exports', input.exportJobId, filename)).replace(
      /\\/g,
      '/',
    );
  }

  private absolutePath(objectKey: string) {
    const fullPath = resolve(this.root, objectKey);
    const relativePath = relative(this.root, fullPath);
    if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
      throw new NotFoundException('Objet introuvable.');
    }
    return fullPath;
  }
}
