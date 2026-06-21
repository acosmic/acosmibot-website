import React from 'react';
import { FeatureToggle } from '@/components/ui';

interface SimpleGameSectionProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  command: string;
  description: string;
}

/** A game whose only server-configurable setting is whether it's enabled. */
export const SimpleGameSection: React.FC<SimpleGameSectionProps> = ({ enabled, onChange, command, description }) => (
  <>
    <p className="text-muted" style={{ marginTop: 0 }}>
      {description} Played with <code>{command}</code>.
    </p>
    <FeatureToggle
      enabled={enabled}
      onChange={onChange}
      description={`Enable ${command} in this server.`}
    />
  </>
);
