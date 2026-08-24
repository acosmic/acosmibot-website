import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, UserRoundPlus } from 'lucide-react';
import {
  adminApi,
  type AdminCosmetic,
  type RankCardBackgroundUpload,
} from '@/api/admin';
import { NumberInput } from '@/components/ui';

/** Owner console for the rank-card catalog and exclusive artwork workflow. */

type Draft = { price: number; is_available: boolean };

const TYPE_LABELS: Record<AdminCosmetic['type'], string> = {
  accent: 'Accent',
  background: 'Background',
  ring: 'Avatar Ring',
};

const TYPE_ORDER: AdminCosmetic['type'][] = ['accent', 'background', 'ring'];

const swatchStyle = (cosmetic: AdminCosmetic): React.CSSProperties => {
  if (cosmetic.asset_url) {
    return {
      backgroundImage: `url("${cosmetic.asset_url}")`,
      backgroundPosition: 'center',
      backgroundSize: 'cover',
    };
  }
  return cosmetic.type === 'background' && /gradient/i.test(cosmetic.value)
    ? { background: cosmetic.value }
    : { backgroundColor: cosmetic.value };
};

const readImageDimensions = (file: File): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(objectUrl);
    };
    image.onerror = () => {
      reject(new Error('The selected file could not be read as an image.'));
      URL.revokeObjectURL(objectUrl);
    };
    image.src = objectUrl;
  });

const errorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export const CosmeticsTab: React.FC = () => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const query = useQuery({
    queryKey: ['admin', 'cosmetics'],
    queryFn: () => adminApi.getCosmetics(),
  });

  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [savedId, setSavedId] = useState<number | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [fileError, setFileError] = useState('');
  const [uploadFields, setUploadFields] = useState({
    name: '',
    description: '',
    rarity: 'epic',
    price: 0,
    isAvailable: false,
  });
  const [grantUserId, setGrantUserId] = useState('');
  const [grantCosmeticId, setGrantCosmeticId] = useState<number | null>(null);

  useEffect(() => {
    if (!query.data?.data) return;
    const next: Record<number, Draft> = {};
    for (const cosmetic of query.data.data) {
      next[cosmetic.id] = {
        price: cosmetic.price,
        is_available: cosmetic.is_available,
      };
    }
    setDrafts(next);
  }, [query.data]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const artworkBackgrounds = useMemo(
    () => (query.data?.data ?? []).filter((cosmetic) => (
      cosmetic.type === 'background' &&
      cosmetic.source === 'admin' &&
      cosmetic.layout_preset === 'artwork' &&
      Boolean(cosmetic.asset_url)
    )),
    [query.data],
  );

  useEffect(() => {
    if (grantCosmeticId === null && artworkBackgrounds.length > 0) {
      setGrantCosmeticId(artworkBackgrounds[0].id);
    }
  }, [artworkBackgrounds, grantCosmeticId]);

  const updateMutation = useMutation({
    mutationFn: ({ id, draft }: { id: number; draft: Draft }) =>
      adminApi.updateCosmetic(id, draft),
    onSuccess: (_response, variables) => {
      setSavedId(variables.id);
      queryClient.invalidateQueries({ queryKey: ['admin', 'cosmetics'] });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (payload: RankCardBackgroundUpload) =>
      adminApi.uploadRankCardBackground(payload),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'cosmetics'] });
      setGrantCosmeticId(response.cosmetic.id);
      setUploadFile(null);
      setPreviewUrl('');
      setFileError('');
      setUploadFields({
        name: '',
        description: '',
        rarity: 'epic',
        price: 0,
        isAvailable: false,
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
  });

  const grantMutation = useMutation({
    mutationFn: ({ discordUserId, cosmeticId }: {
      discordUserId: string;
      cosmeticId: number;
    }) => adminApi.grantRankCardBackground(discordUserId, cosmeticId),
  });

  const byType = useMemo(() => {
    const map: Record<AdminCosmetic['type'], AdminCosmetic[]> = {
      accent: [],
      background: [],
      ring: [],
    };
    for (const cosmetic of query.data?.data ?? []) map[cosmetic.type].push(cosmetic);
    return map;
  }, [query.data]);

  const handleFile = async (file: File | null) => {
    uploadMutation.reset();
    setUploadFile(null);
    setPreviewUrl('');
    setFileError('');
    if (!file) return;
    if (file.type !== 'image/png') {
      setFileError('Choose a PNG file. Other image formats are not accepted.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setFileError('The PNG is larger than 4 MB. Export a smaller file and try again.');
      return;
    }
    try {
      const dimensions = await readImageDimensions(file);
      if (dimensions.width !== 800 || dimensions.height !== 250) {
        setFileError(
          `This file is ${dimensions.width}×${dimensions.height}. Export it at exactly 800×250 pixels.`,
        );
        return;
      }
      setUploadFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    } catch (error) {
      setFileError(errorMessage(error, 'The image could not be validated.'));
    }
  };

  const submitUpload = (event: React.FormEvent) => {
    event.preventDefault();
    uploadMutation.reset();
    if (!uploadFile) {
      setFileError('Choose a valid 800×250 PNG before uploading.');
      return;
    }
    uploadMutation.mutate({ file: uploadFile, ...uploadFields });
  };

  const submitGrant = (event: React.FormEvent) => {
    event.preventDefault();
    grantMutation.reset();
    if (!grantCosmeticId || !/^\d+$/.test(grantUserId)) return;
    grantMutation.mutate({
      discordUserId: grantUserId,
      cosmeticId: grantCosmeticId,
    });
  };

  if (query.isLoading) return <p className="text-muted">Loading cosmetics…</p>;
  if (query.error) {
    return <p className="admin-artwork-message is-error">{errorMessage(query.error, 'Cosmetics could not be loaded.')}</p>;
  }

  const isDirty = (cosmetic: AdminCosmetic) => {
    const draft = drafts[cosmetic.id];
    return draft && (
      draft.price !== cosmetic.price ||
      draft.is_available !== cosmetic.is_available
    );
  };

  const setDraft = (id: number, patch: Partial<Draft>) =>
    setDrafts((current) => ({
      ...current,
      [id]: { ...current[id], ...patch },
    }));

  return (
    <div className="admin-cosmetics">
      <header className="admin-cosmetics__header">
        <h3>Rank-card cosmetics</h3>
        <p>
          Upload exclusive 800×250 artwork, assign it to a Discord ID, and manage
          the materials visible in Card Studio.
        </p>
      </header>

      <section className="admin-artwork" aria-labelledby="rank-artwork-title">
        <div className="admin-artwork__heading">
          <div>
            <h4 id="rank-artwork-title">Special artwork pipeline</h4>
            <p>
              Uploaded backgrounds keep the standard overlay. Only the XP track is
              shortened from 530 px to 265 px.
            </p>
          </div>
          <span>{artworkBackgrounds.length} uploaded</span>
        </div>

        <div className="admin-artwork__workflow">
          <form className="admin-artwork-form" onSubmit={submitUpload}>
            <div className="admin-artwork-form__title">
              <ImagePlus aria-hidden="true" />
              <div><h5>Upload background</h5><p>PNG · exactly 800×250 · maximum 4 MB</p></div>
            </div>

            <label className="admin-artwork-file">
              <span>Artwork file</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,.png"
                onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
                aria-describedby="rank-artwork-file-help"
              />
            </label>
            <p id="rank-artwork-file-help" className="admin-artwork-help">
              The artist’s file becomes the full card background. Uploading does not grant it to anyone.
            </p>

            <div className={`admin-artwork-preview${previewUrl ? ' has-image' : ''}`}>
              {previewUrl ? (
                <img src={previewUrl} alt="Preview of the selected rank-card background" />
              ) : (
                <span>800 × 250 preview</span>
              )}
            </div>

            {fileError && <p className="admin-artwork-message is-error" role="alert">{fileError}</p>}

            <div className="admin-artwork-fields">
              <label>
                <span>Name</span>
                <input
                  className="form-control"
                  value={uploadFields.name}
                  onChange={(event) => setUploadFields((current) => ({
                    ...current,
                    name: event.target.value,
                  }))}
                  maxLength={100}
                  required
                  placeholder="Exile"
                />
              </label>
              <label>
                <span>Rarity</span>
                <select
                  className="form-select"
                  value={uploadFields.rarity}
                  onChange={(event) => setUploadFields((current) => ({
                    ...current,
                    rarity: event.target.value,
                  }))}
                >
                  <option value="common">Common</option>
                  <option value="uncommon">Uncommon</option>
                  <option value="rare">Rare</option>
                  <option value="epic">Epic</option>
                  <option value="legendary">Legendary</option>
                </select>
              </label>
            </div>

            <label>
              <span>Description</span>
              <textarea
                className="form-control"
                value={uploadFields.description}
                onChange={(event) => setUploadFields((current) => ({
                  ...current,
                  description: event.target.value,
                }))}
                maxLength={255}
                rows={2}
                placeholder="Exclusive Acosmicord artwork."
              />
            </label>

            <div className="admin-artwork-fields admin-artwork-fields--final">
              <label>
                <span>Shop price</span>
                <NumberInput
                  className="form-control"
                  min={0}
                  max={2147483647}
                  value={uploadFields.price}
                  onValueChange={(value) => setUploadFields((current) => ({
                    ...current,
                    price: value,
                  }))}
                />
              </label>
              <label className="admin-artwork-check">
                <input
                  type="checkbox"
                  checked={uploadFields.isAvailable}
                  onChange={(event) => setUploadFields((current) => ({
                    ...current,
                    isAvailable: event.target.checked,
                  }))}
                />
                <span>Also list in Card Studio shop</span>
              </label>
            </div>

            <button
              type="submit"
              className="btn primary admin-artwork-submit"
              disabled={uploadMutation.isPending || !uploadFile}
            >
              {uploadMutation.isPending ? 'Uploading…' : 'Upload background'}
            </button>
            {uploadMutation.isSuccess && (
              <p className="admin-artwork-message is-success" role="status">
                {uploadMutation.data.message}. It is ready to grant.
              </p>
            )}
            {uploadMutation.error && (
              <p className="admin-artwork-message is-error" role="alert">
                {errorMessage(uploadMutation.error, 'The upload failed. Try again.')}
              </p>
            )}
          </form>

          <form className="admin-artwork-form admin-artwork-form--grant" onSubmit={submitGrant}>
            <div className="admin-artwork-form__title">
              <UserRoundPlus aria-hidden="true" />
              <div><h5>Assign to a user</h5><p>Add artwork to an existing Acosmibot collection</p></div>
            </div>

            <label>
              <span>Background</span>
              <select
                className="form-select"
                value={grantCosmeticId ?? ''}
                onChange={(event) => setGrantCosmeticId(Number(event.target.value))}
                disabled={artworkBackgrounds.length === 0}
                required
              >
                {artworkBackgrounds.length === 0 ? (
                  <option value="">Upload a background first</option>
                ) : artworkBackgrounds.map((cosmetic) => (
                  <option key={cosmetic.id} value={cosmetic.id}>{cosmetic.name}</option>
                ))}
              </select>
            </label>

            {grantCosmeticId && (
              <div className="admin-artwork-grant-preview">
                <div style={swatchStyle(
                  artworkBackgrounds.find((item) => item.id === grantCosmeticId)
                    ?? artworkBackgrounds[0],
                )} />
                <p>
                  This grants access but does not force-equip it. The member can
                  select it from Card Studio.
                </p>
              </div>
            )}

            <label>
              <span>Discord user ID</span>
              <input
                className="form-control"
                value={grantUserId}
                onChange={(event) => setGrantUserId(event.target.value.replace(/\D/g, ''))}
                inputMode="numeric"
                pattern="[0-9]+"
                autoComplete="off"
                placeholder="123456789012345678"
                required
              />
            </label>
            <p className="admin-artwork-help">
              The user must have used Acosmibot at least once so their Discord ID exists in the database.
            </p>

            <button
              type="submit"
              className="btn primary admin-artwork-submit"
              disabled={
                grantMutation.isPending ||
                !grantCosmeticId ||
                !/^\d+$/.test(grantUserId)
              }
            >
              {grantMutation.isPending ? 'Assigning…' : 'Assign background'}
            </button>
            {grantMutation.isSuccess && (
              <p className="admin-artwork-message is-success" role="status">
                {grantMutation.data.message}.
              </p>
            )}
            {grantMutation.error && (
              <p className="admin-artwork-message is-error" role="alert">
                {errorMessage(grantMutation.error, 'The assignment failed. Check the Discord ID.')}
              </p>
            )}
          </form>
        </div>
      </section>

      <section className="admin-cosmetics__catalog" aria-labelledby="cosmetics-catalog-title">
        <div>
          <h4 id="cosmetics-catalog-title">Catalog controls</h4>
          <p>
            Unavailable items stay in the collections of members who already own them.
          </p>
        </div>

        {TYPE_ORDER.map((type) => (
          <div key={type} className="admin-cosmetic-group">
            <h5>{TYPE_LABELS[type]}</h5>
            <div className="admin-cosmetic-list">
              {byType[type].map((cosmetic) => {
                const draft = drafts[cosmetic.id] ?? {
                  price: cosmetic.price,
                  is_available: cosmetic.is_available,
                };
                return (
                  <div key={cosmetic.id} className="admin-cosmetic-row">
                    <div className="admin-cosmetic-swatch" style={swatchStyle(cosmetic)} />
                    <div className="admin-cosmetic-identity">
                      <strong>{cosmetic.name}</strong>
                      <span>{cosmetic.rarity}{cosmetic.asset_url ? ' · artwork' : ''}</span>
                    </div>
                    <label className="admin-cosmetic-price">
                      <span>Price</span>
                      <NumberInput
                        min={0}
                        value={draft.price}
                        onValueChange={(value) => setDraft(cosmetic.id, { price: value })}
                        className="form-control"
                      />
                    </label>
                    <label className="admin-cosmetic-available">
                      <input
                        type="checkbox"
                        checked={draft.is_available}
                        onChange={(event) => setDraft(cosmetic.id, {
                          is_available: event.target.checked,
                        })}
                      />
                      <span>Available</span>
                    </label>
                    <div className="admin-cosmetic-save">
                      {savedId === cosmetic.id && !isDirty(cosmetic) && !updateMutation.isPending && (
                        <span role="status">Saved</span>
                      )}
                      <button
                        type="button"
                        className="btn btn-sm primary"
                        disabled={!isDirty(cosmetic) || updateMutation.isPending}
                        onClick={() => updateMutation.mutate({ id: cosmetic.id, draft })}
                      >
                        {updateMutation.isPending && updateMutation.variables?.id === cosmetic.id
                          ? 'Saving…'
                          : 'Save'}
                      </button>
                    </div>
                  </div>
                );
              })}
              {byType[type].length === 0 && <p className="text-muted">No items.</p>}
            </div>
          </div>
        ))}
        {updateMutation.error && (
          <p className="admin-artwork-message is-error" role="alert">
            {errorMessage(updateMutation.error, 'The catalog update failed.')}
          </p>
        )}
      </section>
    </div>
  );
};
