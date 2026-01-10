// src/models/Backup.ts
import mongoose, { Document, Schema } from "mongoose";

export interface IBackup extends Document {
  userId: mongoose.Types.ObjectId;
  data: any; // JSON do backup
  updatedAt: Date;
}

const BackupSchema = new Schema<IBackup>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  data: { type: Schema.Types.Mixed, required: true },
  updatedAt: { type: Date, default: Date.now },
});

export const BackupModel = mongoose.model<IBackup>("Backup", BackupSchema);
