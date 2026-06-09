import * as Dialog from "@radix-ui/react-dialog";
import { Play, X } from "lucide-react";
import { type ReactNode } from "react";

interface HeroVideoDialogProps {
  className?: string;
  animationStyle?: "from-center" | "from-bottom" | "from-top";
  videoSrc: string;
  thumbnailSrc: string;
  thumbnailAlt: string;
}

export function HeroVideoDialog({
  className,
  animationStyle = "from-center",
  videoSrc,
  thumbnailSrc,
  thumbnailAlt,
}: HeroVideoDialogProps) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className={`group relative overflow-hidden rounded-[2rem] border border-border/80 bg-background/95 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_30px_90px_-46px_rgba(15,23,42,0.45)] ${className ?? ""}`}
        >
          <img
            src={thumbnailSrc}
            alt={thumbnailAlt}
            className="h-full w-full object-cover transition duration-300 group-hover:brightness-90"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/10">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/90 text-white shadow-[0_20px_80px_-40px_rgba(255,108,46,0.55)] transition duration-200 group-hover:scale-105">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                <Play className="h-6 w-6" />
              </div>
            </div>
          </div>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,1120px)] max-h-[90vh] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/95 shadow-2xl focus:outline-none">
          <Dialog.Close asChild>
            <button className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-white ring-1 ring-white/10 transition hover:bg-black/90">
              <X className="h-5 w-5" />
            </button>
          </Dialog.Close>
          <div className="aspect-video w-full overflow-hidden bg-black">
            <iframe
              src={videoSrc}
              title="Hero video"
              className="h-full w-full rounded-[2rem]"
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
