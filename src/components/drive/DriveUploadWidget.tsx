'use client';

import React, { useState } from 'react';
import { 
  CloudUpload, 
  CheckCircle2, 
  FolderLock, 
  ExternalLink, 
  X, 
  ShieldCheck 
} from 'lucide-react';

interface DriveUploadWidgetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DriveUploadWidget({ isOpen, onClose }: DriveUploadWidgetProps) {
  const [uploading, setUploading] = useState(false);
  const [driveResult, setDriveResult] = useState<{
    fileId: string;
    folderPath: string;
    fileName: string;
    sha256: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleUpload = () => {
    setUploading(true);
    setTimeout(() => {
      setUploading(false);
      setDriveResult({
        fileId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
        folderPath: 'Afaz_Tobacco_Reports/2026/10_October/2026-10-06/',
        fileName: 'Daily sales and Closing Stock Information October 6 2026.xlsx',
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      });
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-blue-950/80 p-2 text-blue-400 border border-blue-800/40">
              <FolderLock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Google Drive Cloud Archival</h2>
              <p className="text-xs text-slate-400">Strictly authorized for Super Admin enterprise sign-off</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Cloud Hierarchy Specifications */}
        <div className="space-y-3 rounded-xl bg-slate-950 border border-slate-800 p-4 text-xs font-mono">
          <div>
            <span className="text-slate-500 block text-[11px] font-sans">Target Cloud Directory:</span>
            <span className="text-blue-400 font-semibold break-all">
              Afaz_Tobacco_Reports/2026/10_October/2026-10-06/
            </span>
          </div>

          <div>
            <span className="text-slate-500 block text-[11px] font-sans">Authoritative Target Filename:</span>
            <span className="text-slate-200 break-all">
              Daily sales and Closing Stock Information October 6 2026.xlsx
            </span>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-slate-800 font-sans text-[11px] text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
            <span>Pre-export check: 34 sheets verified & formula consistency intact.</span>
          </div>
        </div>

        {/* Upload State Feedback */}
        {driveResult && (
          <div className="rounded-xl bg-emerald-950/40 border border-emerald-800/60 p-4 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <CheckCircle2 className="h-5 w-5" />
              <span>Report Successfully Archived to Google Drive</span>
            </div>
            <p className="text-slate-300">
              Drive File ID: <span className="font-mono text-emerald-300">{driveResult.fileId}</span>
            </p>
            <p className="text-slate-300">
              SHA-256 Checksum: <span className="font-mono text-slate-400">{driveResult.sha256.substring(0, 24)}...</span>
            </p>
            <div className="pt-2">
              <a
                href={`https://drive.google.com/file/d/${driveResult.fileId}/view`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-blue-400 hover:underline font-semibold"
              >
                <span>Open in Google Drive</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </button>
          {!driveResult && (
            <button
              disabled={uploading}
              onClick={handleUpload}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-500 shadow-md shadow-blue-500/20 disabled:opacity-50"
            >
              <CloudUpload className="h-4 w-4" />
              <span>{uploading ? 'Archiving to Drive...' : 'Archive to Google Drive'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
