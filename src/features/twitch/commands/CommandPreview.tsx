/** "What this command does": the trigger, level, cooldown and cost of a draft in plain sentences. */
import React from 'react';
import { Clock, Coins, MessageSquare, Radio, Users, Zap } from 'lucide-react';
import type { AccessPreview } from './model';

const ROWS: Array<{ key: keyof AccessPreview; label: string; icon: React.ReactNode }> = [
  { key: 'trigger', label: 'Trigger', icon: <Zap aria-hidden="true" size={16} /> },
  { key: 'who', label: 'Who', icon: <Users aria-hidden="true" size={16} /> },
  { key: 'cooldown', label: 'Cooldown', icon: <Clock aria-hidden="true" size={16} /> },
  { key: 'cost', label: 'Cost', icon: <Coins aria-hidden="true" size={16} /> },
  { key: 'when', label: 'When', icon: <Radio aria-hidden="true" size={16} /> },
  { key: 'how', label: 'Answer', icon: <MessageSquare aria-hidden="true" size={16} /> },
];

export const CommandPreview: React.FC<{ preview: AccessPreview; title?: string; omit?: Array<keyof AccessPreview> }> = ({
  preview, title = 'What this command does', omit = [],
}) => (
  <section className="tw-cmd-preview" aria-label={title}>
    <h3>{title}</h3>
    <dl>
      {ROWS.filter((row) => !omit.includes(row.key)).map((row) => (
        <div key={row.key} className="tw-cmd-preview__row">
          <dt>{row.icon}<span>{row.label}</span></dt>
          <dd>{preview[row.key]}</dd>
        </div>
      ))}
    </dl>
  </section>
);
