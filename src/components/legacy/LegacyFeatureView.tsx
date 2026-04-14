import React, { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';

interface LegacyFeatureViewProps {
  feature: string;
}

export const LegacyFeatureView: React.FC<LegacyFeatureViewProps> = ({ feature }) => {
  const { guildId } = useParams<{ guildId: string }>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Fetch the feature HTML
    const loadFeature = async () => {
      try {
        const response = await fetch(`/server/views/${feature}-view.html`);
        if (!response.ok) throw new Error(`Failed to load ${feature} view`);
        const htmlContent = await response.text();
        containerRef.current!.innerHTML = htmlContent;

        // 2. Load the feature script
        const script = document.createElement('script');
        script.src = `/scripts/features/${feature}.js?v=${new Date().getTime()}`;
        script.id = `legacy-script-${feature}`;
        document.body.appendChild(script);

        script.onload = () => {
          // 3. Initialize the feature
          const featureName = feature.charAt(0).toUpperCase() + feature.slice(1) + 'Feature';
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
      // Cleanup
      const script = document.getElementById(`legacy-script-${feature}`);
      if (script) script.remove();
      
      const featureName = feature.charAt(0).toUpperCase() + feature.slice(1) + 'Feature';
      const legacyFeature = (window as any)[featureName];
      if (legacyFeature && legacyFeature.cleanup) {
        legacyFeature.cleanup();
      }
    };
  }, [feature, guildId]);

  return <div ref={containerRef} className="legacy-feature-container" />;
};
