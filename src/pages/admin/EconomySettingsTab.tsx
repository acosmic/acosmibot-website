import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, AdminEconomySettings, InterestInterval } from '@/api/admin';
import { FeatureToggle, NumberInput } from '@/components/ui';

type FormState = Omit<AdminEconomySettings, 'interest_intervals'>;
type NumericFormField = {
  [K in keyof FormState]: FormState[K] extends number ? K : never;
}[keyof FormState];

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-light)',
  color: 'var(--text-primary)',
  maxWidth: 220,
};

export const EconomySettingsTab: React.FC = () => {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['admin', 'economy-settings'],
    queryFn: () => adminApi.getEconomySettings(),
  });

  const [form, setForm] = useState<FormState | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (query.data?.data) {
      const { interest_intervals: _intervals, ...rest } = query.data.data;
      setForm(rest);
    }
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: (payload: FormState) => adminApi.updateEconomySettings(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'economy-settings'] });
      setSavedAt(Date.now());
    },
  });

  if (query.isLoading || !form) {
    return <p className="text-muted">Loading...</p>;
  }
  if (query.error) {
    return <p style={{ color: 'var(--error-color)' }}>Error: {String(query.error)}</p>;
  }

  const intervals: InterestInterval[] = query.data?.data.interest_intervals ?? ['daily', 'weekly', 'monthly'];
  const limitsInvalid = form.min_transaction > form.max_transaction;

  const numField = (
    label: string,
    field: NumericFormField,
    helper: string,
    step = 1,
  ) => (
    <div className="mb-4">
      <label className="form-label mb-2 d-block">{label}</label>
      <NumberInput
        min={0}
        step={step}
        className="form-control"
        value={form[field]}
        onValueChange={(value) => setForm({ ...form, [field]: value })}
        style={inputStyle}
      />
      <p className="text-muted small mt-2 mb-0">{helper}</p>
    </div>
  );

  return (
    <div style={{ maxWidth: 720 }}>
      <h3 className="mb-4">Economy Settings</h3>
      <p className="text-muted mb-4">
        Bot-wide banking and interest configuration. Changes take effect immediately for all servers.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (limitsInvalid) return;
          mutation.mutate(form);
        }}
      >
        <h5 className="mb-3" style={{ color: 'var(--text-primary)' }}>Bank Fees</h5>
        {numField('Deposit fee (%)', 'deposit_fee_percent', 'Percentage taken when depositing into the bank.', 0.1)}
        {numField('Withdraw fee (%)', 'withdraw_fee_percent', 'Percentage taken when withdrawing from the bank.', 0.1)}

        <h5 className="mb-3 mt-4" style={{ color: 'var(--text-primary)' }}>Transaction Limits</h5>
        <FeatureToggle
          enabled={form.transaction_limits_enabled}
          onChange={(enabled) => setForm({ ...form, transaction_limits_enabled: enabled })}
          label="Enforce transaction limits"
          description="Apply the minimum, maximum, and cumulative daily limits to deposits and withdrawals."
        />
        {!form.transaction_limits_enabled && (
          <p
            className="small mb-4"
            role="status"
            style={{
              color: 'var(--text-secondary)',
              background: 'var(--bg-secondary)',
              borderRadius: 8,
              padding: '12px 14px',
            }}
          >
            Limits are disabled. These values are still saved and will take effect when enforcement is enabled.
          </p>
        )}
        {numField('Minimum transaction', 'min_transaction', 'Smallest credit amount allowed in a deposit/withdraw.')}
        {numField('Maximum transaction', 'max_transaction', 'Largest credit amount allowed in a single deposit/withdraw.')}
        {limitsInvalid && (
          <p role="alert" style={{ color: 'var(--error-color)', marginTop: '-8px' }}>
            Maximum transaction must be greater than or equal to the minimum.
          </p>
        )}
        {numField(
          'Daily transfer limit',
          'daily_transfer_limit',
          'Combined deposits and withdrawals allowed per user each calendar day.',
        )}

        <h5 className="mb-3 mt-4" style={{ color: 'var(--text-primary)' }}>Interest</h5>
        <FeatureToggle
          enabled={form.interest_enabled}
          onChange={(enabled) => setForm({ ...form, interest_enabled: enabled })}
          label="Pay bank interest"
          description="Apply the configured rate when a member's daily reward runs and the selected interval is due."
        />

        {numField(
          'Interest rate (%)',
          'interest_rate_percent',
          'Percentage of the current bank balance paid once per selected interval.',
          0.1,
        )}

        <div className="mb-4">
          <label className="form-label mb-2 d-block">Interest interval</label>
          <select
            className="form-control"
            value={form.interest_interval}
            onChange={(e) => setForm({ ...form, interest_interval: e.target.value as InterestInterval })}
            style={inputStyle}
          >
            {intervals.map((iv) => (
              <option key={iv} value={iv}>{iv}</option>
            ))}
          </select>
          <p className="text-muted small mt-2 mb-0">How often interest is applied.</p>
        </div>

        <div className="d-flex align-items-center gap-3 mt-4">
          <button
            type="submit"
            className="btn primary"
            disabled={mutation.isPending || limitsInvalid}
          >
            {mutation.isPending ? 'Saving...' : 'Save'}
          </button>
          {mutation.error && (
            <span style={{ color: 'var(--error-color)' }}>Error: {String(mutation.error)}</span>
          )}
          {!mutation.error && savedAt && Date.now() - savedAt < 4000 && (
            <span role="status" aria-live="polite" style={{ color: 'var(--success-color)' }}>Saved</span>
          )}
        </div>
      </form>
    </div>
  );
};
