import React, { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

interface LegacyFeatureViewProps {
  feature: string;
}

// Convert kebab-case to PascalCase: 'reaction-roles' -> 'ReactionRolesFeature'
function toPascalCase(kebab: string): string {
  return kebab
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

export const LegacyFeatureView: React.FC<LegacyFeatureViewProps> = ({ feature }) => {
  const { guildId } = useParams<{ guildId: string }>();
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!containerRef.current) return;

    const loadFeature = async () => {
      try {
        const response = await fetch(`/server/views/${feature}-view.html`);
        if (!response.ok) throw new Error(`Failed to load ${feature} view`);
        const htmlContent = await response.text();
        containerRef.current!.innerHTML = htmlContent;

        // Determine API base URL
        const apiBase =
          (window as any).AppConfig?.apiBaseUrl ??
          (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:5000'
            : 'https://api.acosmibot.com');

        // Fetch guild config so legacy features have access to channels/roles/emojis
        let guildConfig: any = null;
        try {
          const token = localStorage.getItem('discord_token');
          const configRes = await fetch(`${apiBase}/api/guilds/${guildId}/config-hybrid`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (configRes.ok) {
            const configData = await configRes.json();
            guildConfig = configData.data;
          }
        } catch (e) {
          console.warn('[LegacyFeatureView] Could not load guild config:', e);
        }

        // Provide a minimal DashboardCore bridge for legacy feature scripts
        (window as any).DashboardCore = {
          API_BASE_URL: apiBase,
          state: {
            currentGuildId: guildId,
            guildConfig,
          },
          initForSPA: async () => {},
          loadFeature: (route: string) => navigate(`/server/${guildId}/${route}`),
          showNotification: (message: string, type: string) => {
            console.log(`[LegacyNotification][${type}] ${message}`);
          },
          showError: (message: string) => console.error(`[LegacyError] ${message}`),
          showLoading: () => {},
        };

        // Load the feature script
        const script = document.createElement('script');
        script.src = `/scripts/features/${feature}.js?v=${new Date().getTime()}`;
        script.id = `legacy-script-${feature}`;
        document.body.appendChild(script);

        script.onload = () => {
          const featureName = toPascalCase(feature) + 'Feature';
          const legacyFeature = (window as any)[featureName];
          if (legacyFeature && legacyFeature.init) {
            legacyFeature.init(guildId);
          }
        };
      } catch (error) {
        console.error('Error loading legacy feature:', error);
      }
    };

    loadFeature();

    return () => {
      const script = document.getElementById(`legacy-script-${feature}`);
      if (script) script.remove();

      const featureName = toPascalCase(feature) + 'Feature';
      const legacyFeature = (window as any)[featureName];
      if (legacyFeature && legacyFeature.cleanup) {
        legacyFeature.cleanup();
      }
    };
  }, [feature, guildId]);

  return <div ref={containerRef} className="legacy-feature-container" />;
};
