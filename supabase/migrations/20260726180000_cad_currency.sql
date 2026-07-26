-- CAD joins the accepted currencies.
--
-- WHY IT MATTERS, and it is not a formality: Canadian remote roles were being
-- shown WITHOUT their pay. The source stated 120 000–150 000 CAD in structured
-- fields, the currency filter did not recognise the code, and the connector
-- dropped the whole compensation block — amount, currency and period together,
-- because half a salary is worse than none.
--
-- The result on screen was an offer that looked like it disclosed nothing,
-- when in fact it had disclosed everything. A currency we refuse to name does
-- not protect anyone; it hides money that was stated plainly, and it does so
-- invisibly, which is the part that makes it a bug rather than a limitation.
--
-- The owner asked for remote work in the United States and CANADA, and for
-- roles that pay well. Ranking by pay is only honest if the pay that was
-- published actually survives the pipeline.
--
-- Widening a CHECK is safe by construction: every row that satisfied the old
-- constraint satisfies the new one. Nothing is rewritten, nothing is lost.

alter table public.opportunities
  drop constraint if exists opportunities_compensation_currency_check;

alter table public.opportunities
  add constraint opportunities_compensation_currency_check
  check (compensation_currency in ('EUR', 'USD', 'GBP', 'CHF', 'CAD'));
