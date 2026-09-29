import { getTranslations } from 'next-intl/server';

/**
 * What the product covers, stated as capability tiles with no numbers.
 *
 * The template put a social-proof stat row here: "200+ schools", "1.2M students
 * managed". `AGENTS.md` 2.8 names both as false of this product, and inventing
 * replacement figures would be exactly the failure D28 records — substituting an
 * unverified number for a removed one.
 *
 * So there are no numbers. The template's own KPI labels are truthful
 * descriptors of what the system does, and they are reused as such. The e2e
 * suite asserts that none of the removed claims reappears.
 *
 * The `id` is the target of the hero's second call to action.
 */
export async function CapabilityStrip() {
  const t = await getTranslations('landing');

  const capabilities = ['kpiStudents', 'kpiAttendance', 'kpiFees', 'kpiLeave'] as const;

  return (
    <section id="capabilities" className="border-border border-y">
      <div className="mx-auto w-full max-w-5xl px-6 py-4">
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {capabilities.map((key) => (
            <li
              key={key}
              className="border-border bg-surface rounded-card border px-4 py-3 text-center text-sm font-medium"
            >
              {t(key)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
