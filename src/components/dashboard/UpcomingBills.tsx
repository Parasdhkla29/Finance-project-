import { addDays, format, isWithinInterval } from 'date-fns';
import { useSubscriptionStore } from '../../store/useSubscriptionStore';
import { formatCurrency } from '../../core/types';

export default function UpcomingBills() {
  const { subscriptions } = useSubscriptionStore();

  const now = new Date();
  const next7 = addDays(now, 7);

  const upcoming = subscriptions
    .filter((s) => {
      if (!s.isActive || s.deletedAt) return false;
      const due = new Date(s.nextBillingDate);
      return isWithinInterval(due, { start: now, end: next7 });
    })
    .sort((a, b) => a.nextBillingDate.localeCompare(b.nextBillingDate));

  if (upcoming.length === 0) {
    return <p className="text-slate-400 text-sm">No bills due in the next 7 days</p>;
  }

  return (
    <ul className="divide-y divide-slate-200/50" role="list">
      {upcoming.map((sub) => (
        <li key={sub.id} className="flex items-center justify-between py-2.5">
          <div>
            <p className="text-sm font-medium text-slate-800">{sub.name}</p>
            <p className="text-xs text-slate-400">
              Due {format(new Date(sub.nextBillingDate), 'EEE d MMM')}
            </p>
          </div>
          <span className="text-sm font-semibold text-amber-600">
            {formatCurrency(sub.amountMinorUnits, sub.currency)}
          </span>
        </li>
      ))}
    </ul>
  );
}
