// src/models/AccessCode.ts
import mongoose, { Document, Schema } from "mongoose";

export interface IAccessCode extends Document {
  code: string;
  used: boolean;
  usedAt?: Date;
  generatedByUserId?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const AccessCodeSchema = new Schema<IAccessCode>({
  code: { type: String, required: true, unique: true },
  used: { type: Boolean, default: false },
  usedAt: { type: Date },
  generatedByUserId: { type: Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

export const AccessCodeModel = mongoose.model<IAccessCode>(
  "AccessCode",
  AccessCodeSchema
);
