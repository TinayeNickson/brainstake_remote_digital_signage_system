import Link from 'next/link';
import Image from 'next/image';

interface Props {
  href?: string;
  tone?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export default function BrandMark({ href = '/', tone = 'dark', size = 'md' }: Props) {
  const dim = size === 'xl' ? 64 : size === 'lg' ? 48 : size === 'sm' ? 32 : 40;
  const textCls = size === 'xl' ? 'text-3xl' : size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-lg' : 'text-xl';
  const subSize = size === 'xl' ? 'text-[11px] tracking-[0.3em] mt-[5px]' : 'text-[9px] tracking-[0.28em] mt-[3px]';
  const subCls  = tone === 'light' ? 'text-white/60' : 'text-ink-900/50';
  const wordCls = tone === 'light' ? 'text-white' : 'text-ink-900';

  const content = (
    <span className="inline-flex items-center gap-2.5">
      <span className="shrink-0" style={{ width: dim, height: dim }}>
        <Image
          src="/logo.png"
          alt="Brainstake logo"
          width={dim}
          height={dim}
          className="object-contain"
          priority
        />
      </span>
      <span className="inline-flex flex-col leading-none">
        <span className={`font-bold tracking-tight ${textCls} ${wordCls}`}>BRAINSTAKE</span>
        <span className={`uppercase font-medium ${subSize} ${subCls}`}>
          Remote Digital Signage
        </span>
      </span>
    </span>
  );

  return href ? (
    <Link href={href} className="inline-block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded">
      {content}
    </Link>
  ) : (
    <span className="inline-block">{content}</span>
  );
}
