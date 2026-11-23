import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, LockKeyhole } from 'lucide-react';
import type { Role } from '../types';
import { roleLabel } from '../shared/roles';
import { useOptionalChannel } from '../shared/useChannel';

export interface RoleRequiredProps {
  required: Role;
  /** Role the user has on this channel, when known. */
  current?: Role | null;
  sectionLabel?: string;
}

/**
 * Shown instead of a page the user's role cannot open (§11.1). It explains
 * the rule; the API enforces it independently.
 */
export const RoleRequired: React.FC<RoleRequiredProps> = ({ required, current, sectionLabel }) => {
  const { channelId } = useParams<{ channelId: string }>();
  const channel = useOptionalChannel();
  const role = current ?? channel?.role ?? null;

  return (
    <section className="tw-role-required" aria-labelledby="tw-role-required-title">
      <span className="tw-role-required__icon" aria-hidden="true"><LockKeyhole /></span>
      <div className="tw-role-required__copy">
        <h2 id="tw-role-required-title">You need the {roleLabel(required)} role</h2>
        <p>
          {sectionLabel ? `${sectionLabel} is` : 'This page is'} available to {roleLabel(required).toLowerCase()}s
          {required !== 'broadcaster' ? ' and above' : ''}.
          {role ? ` You are ${role === 'editor' ? 'an' : 'a'} ${roleLabel(role).toLowerCase()} on this channel.` : ''}
          {' '}Ask the broadcaster if you need access.
        </p>
        {channelId && (
          <Link className="btn" to={`/twitch/c/${channelId}/overview`}>
            <ArrowLeft aria-hidden="true" size={16} />
            Back to overview
          </Link>
        )}
      </div>
    </section>
  );
};
