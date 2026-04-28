import { useState } from 'react'

interface Props {
  offline?: boolean
}

export default function CameraFeed({ offline }: Props) {
  const [imgError, setImgError] = useState(false)

  return (
    <div className="rounded-xl overflow-hidden border border-border bg-card flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Live Camera Feed
        </span>
        <span className={`flex items-center gap-1.5 text-[10px] font-semibold ${
          offline || imgError ? 'text-red-400' : 'text-emerald-400'
        }`}>
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${
            offline || imgError ? 'bg-red-400' : 'bg-emerald-400 animate-pulse'
          }`} />
          {offline || imgError ? 'Offline' : 'Live'}
        </span>
      </div>

      {/* MJPEG stream */}
      <div className="relative bg-black flex items-center justify-center" style={{ minHeight: 180 }}>
        {!offline && !imgError ? (
          <img
            src="/stream"
            alt="Annotated camera feed"
            className="w-full h-auto object-contain"
            style={{ maxHeight: 320 }}
            onError={() => setImgError(true)}
          />
        ) : (
          /* Offline placeholder */
          <div className="flex flex-col items-center justify-center gap-3 py-8 px-4 text-center">
            <svg className="w-8 h-8 text-muted-foreground/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M15 10l4.553-2.069A1 1 0 0121 8.87V15.13a1 1 0 01-1.447.9L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
              <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <p className="text-xs text-muted-foreground/60">
              Camera unavailable
              <br />
              <span className="text-[10px]">Start the detector backend to see the feed</span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
