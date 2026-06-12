import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function PageHeader({
  index,
  title,
  description,
  client,
}: {
  index: string;
  title: string;
  description: string;
  client?: string;
}) {
  return (
    <header className="brand-gradient text-white">
      <div className="bg-brand-grid">
        <div className="max-w-5xl mx-auto px-6 pt-8 pb-7">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft size={15} />
            Panel principal
          </Link>

          <div className="flex items-baseline gap-3 mb-2 flex-wrap">
            <span className="font-mono-tab text-xs tracking-[0.2em] bg-white/10 border border-white/20 px-2 py-0.5 rounded-sm">
              MÓD. {index}
            </span>
            {client && (
              <span className="font-mono-tab text-xs tracking-[0.15em] text-white/70 uppercase">
                Cliente: {client}
              </span>
            )}
          </div>

          <h1 className="font-serif-display text-3xl sm:text-4xl leading-tight">
            {title}
          </h1>

          <p className="text-white/75 mt-3 max-w-2xl leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </header>
  );
}
