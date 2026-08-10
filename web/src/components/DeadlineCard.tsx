import { FormattedMessage } from "react-intl";
import type { LetterClassification } from "../lib/rules";
import { useLocale } from "../i18n/LocaleProvider";
import { formatLongDate, urgencyFromDays } from "../lib/format";

/**
 * The big, prominent deadline. When the letter contained a dated deadline we
 * show the date and the days remaining, colored by urgency. When it did not, we
 * never invent one: we point the reader back to the letter and, if the rule has
 * a typical window, show it as guidance only.
 */
export function DeadlineCard({ classification }: { classification: LetterClassification }) {
  const { locale } = useLocale();
  const { deadlineISO, daysUntilDeadline, deadlineFoundInLetter, typicalWindowDays } =
    classification;

  if (deadlineFoundInLetter && deadlineISO) {
    const urgency = urgencyFromDays(daysUntilDeadline);
    const dateText = formatLongDate(deadlineISO, locale);

    return (
      <section className={`deadline-card deadline-${urgency}`} aria-labelledby="deadline-heading">
        <h3 id="deadline-heading" className="deadline-label">
          <FormattedMessage id="deadline.heading" />
        </h3>
        <p className="deadline-date">{dateText}</p>
        <p className="deadline-countdown">
          {daysUntilDeadline === 0 ? (
            <FormattedMessage id="deadline.today" />
          ) : daysUntilDeadline != null && daysUntilDeadline > 0 ? (
            <FormattedMessage id="deadline.daysLeft" values={{ days: daysUntilDeadline }} />
          ) : (
            <FormattedMessage
              id="deadline.past"
              values={{ days: Math.abs(daysUntilDeadline ?? 0) }}
            />
          )}
        </p>
        <p className="deadline-note">
          <FormattedMessage id="deadline.estimateNote" />
        </p>
      </section>
    );
  }

  return (
    <section className="deadline-card deadline-unknown" aria-labelledby="deadline-heading">
      <h3 id="deadline-heading" className="deadline-label">
        <FormattedMessage id="deadline.heading" />
      </h3>
      <p className="deadline-date">
        <FormattedMessage id="deadline.unknownTitle" />
      </p>
      <p className="deadline-note">
        {typicalWindowDays != null ? (
          <FormattedMessage id="deadline.typicalWindow" values={{ days: typicalWindowDays }} />
        ) : (
          <FormattedMessage id="deadline.noWindow" />
        )}
      </p>
    </section>
  );
}
