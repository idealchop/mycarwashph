import Link from "next/link";
import { ShopPageFrame } from "@/components/shop/page-frame";
import { LEGAL_DRAFT_NOTICE, type LegalDoc } from "@/lib/legal";

/** Public legal document: black-and-white containers inside the shop page gutter. */
export function LegalPage({ doc }: { doc: LegalDoc }) {
  const other = doc.slug === "terms" ? { href: "/privacy", label: "Privacy Policy" } : { href: "/terms", label: "Terms of Service" };
  return (
    <main className="min-h-dvh bg-white text-black">
      <ShopPageFrame>
        <nav className="flex items-center justify-between text-[13.5px] font-semibold">
          <Link href="/" className="underline-offset-4 hover:underline">← Mycarwash.ph</Link>
          <Link href={other.href} className="underline-offset-4 hover:underline">{other.label}</Link>
        </nav>
        <header className="mt-5 rounded-[22px] border border-black bg-black px-5 py-6 text-white">
          <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-white/60">Mycarwash.ph for vendors</p>
          <h1 className="mt-1.5 text-[28px] font-extrabold leading-[1.15] tracking-[-0.025em]">{doc.title}</h1>
          <p className="mt-2 text-[13.5px] font-medium text-white/70">{doc.effective} · {LEGAL_DRAFT_NOTICE}</p>
        </header>
        <div className="mt-4 space-y-3 rounded-[22px] border border-black px-5 py-5 text-[15px] leading-relaxed">
          {doc.intro.map((p, i) => <p key={i}>{p}</p>)}
        </div>
        <ol className="mt-4 rounded-[22px] border border-black px-5 py-5 text-[14px] font-semibold">
          {doc.sections.map((s) => (
            <li key={s.id} className="py-1"><a href={`#${s.id}`} className="underline-offset-4 hover:underline">{s.title}</a></li>
          ))}
        </ol>
        <div className="mt-4 space-y-4">
          {doc.sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-6 rounded-[22px] border border-black px-5 py-5">
              <h2 className="text-[18px] font-extrabold tracking-[-0.015em]">{s.title}</h2>
              <div className="mt-2.5 space-y-2.5 text-[15px] leading-relaxed">
                {s.blocks.map((b, i) =>
                  typeof b === "string" ? (
                    <p key={i}>{b}</p>
                  ) : (
                    <ul key={i} className="list-disc space-y-1.5 pl-5">
                      {b.list.map((item, j) => <li key={j} dangerouslySetInnerHTML={{ __html: item }} />)}
                    </ul>
                  ),
                )}
              </div>
            </section>
          ))}
        </div>
      </ShopPageFrame>
    </main>
  );
}
