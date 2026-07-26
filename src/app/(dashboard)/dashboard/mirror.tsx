import type { Understood } from "@/lib/profile/understood";
import { t } from "@/lib/copy";

/**
 * The mirror: what we understood, said back.
 *
 * Two rules hold this component together.
 *
 * A line we could not fill says so — plainly, in the same list as the ones we
 * could. Hiding the gaps would make the reading look complete when it is not,
 * and the whole product rests on `null` meaning "the source did not say"
 * rather than "nothing to see here".
 *
 * And nothing here is a form. This is evidence that we listened; the asking
 * happens after, once. A screen that reflects and interrogates at the same
 * time is just a form with a friendly header.
 */
export function Mirror({ understood }: { understood: Understood }) {
  const copy = t().home;
  return (
    <section
      aria-labelledby="mirror-heading"
      className="border-border flex flex-col gap-4 rounded-lg border p-5"
    >
      <h2 id="mirror-heading" className="text-sm font-medium">
        {copy.mirrorHeading}
      </h2>

      <dl className="flex flex-col gap-3">
        {understood.lines.map((line) => (
          <div key={line.kind} className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">{line.label}</dt>
            <dd
              className={
                line.value === null
                  ? "text-muted-foreground text-sm italic"
                  : "text-sm font-medium"
              }
            >
              {line.value ?? copy.mirrorUnknown}
            </dd>
          </div>
        ))}
      </dl>

      {understood.skills.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-xs">
            {copy.mirrorSkills(understood.skills.length)}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {understood.skills.slice(0, 12).map((skill) => (
              <li
                key={skill}
                className="border-border rounded-full border px-2.5 py-0.5 text-xs"
              >
                {skill}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
