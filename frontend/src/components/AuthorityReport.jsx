import React, { useMemo, useState } from 'react';
import { X, Copy, Mail, Printer } from 'lucide-react';
import { useT } from '../services/i18n';
import { displayPlace } from '../services/geo';

const mapLink = ([lat, lng]) => `https://www.google.com/maps?q=${lat},${lng}`;

// A ready-to-send complaint about the hazards on the chosen route: copy it, open it in an email,
// or print / save as PDF (same print styles as the route report).
export default function AuthorityReport({ routeData, onClose }) {
  const { t, lang } = useT();
  const [to, setTo] = useState(() => t('authority.toDefault'));
  const [copied, setCopied] = useState(false);
  const from = routeData.originAddress || displayPlace(routeData.startLocation);
  const dest = routeData.destinationAddress || displayPlace(routeData.destination);
  const hazards = routeData.hazards || [];

  const { subject, text } = useMemo(() => {
    const date = (h) => (h.capturedAt ? new Date(`${h.capturedAt}-01`).toLocaleString(lang, { month: 'short', year: 'numeric' }) : '—');
    const rows = hazards.map((h, i) => t('authority.row', {
      n: i + 1,
      type: t(`type.${h.category}`),
      sev: t(`sev.${h.adjustedSeverity || h.severity}`),
      where: `${h.coords[0].toFixed(5)}, ${h.coords[1].toFixed(5)} (${t('authority.map')}: ${mapLink(h.coords)})`,
      src: h.crowd ? t('authority.srcCrowd', { n: h.sightings }) : t('authority.srcDetected', { date: date(h) }),
    }));
    return {
      subject: t('authority.subject', { from, to: dest }),
      text: [t('authority.intro', { from, to: dest }), '', ...rows, '', t('authority.closing')].join('\n'),
    };
  }, [hazards, lang, from, dest]); // eslint-disable-line react-hooks/exhaustive-deps

  const copy = async () => {
    try { await navigator.clipboard.writeText(`${t('authority.to')}: ${to}\n${subject}\n\n${text}`); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
  };
  const mail = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text.slice(0, 1800))}`; // long mailto links get cut by mail apps

  return (
    <div className="modal-backdrop-overlay" onClick={onClose}>
      <div className="modal-dialog-box modal-lg" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t('authority.title')}>
        <div className="modal-header-row no-print authority-head">
          <div className="modal-title-wrap"><h3 className="modal-title">{t('authority.title')}</h3></div>
          <div className="modal-actions-inline authority-actions">
            <button type="button" className="btn-secondary btn-sm" onClick={copy}><Copy size={14} /> {copied ? t('authority.copied') : t('authority.copy')}</button>
            <a className="btn-secondary btn-sm" href={mail}><Mail size={14} /> {t('authority.email')}</a>
            <button type="button" className="btn-secondary btn-sm" onClick={() => window.print()}><Printer size={14} /> {t('authority.print')}</button>
            <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
          </div>
        </div>

        <div className="printable-report-content" style={{ display: 'grid', gap: 10 }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <strong>{t('authority.to')}</strong>
            <input className="form-input" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <div><strong>{subject}</strong></div>
          {hazards.length === 0
            ? <p>{t('authority.none')}</p>
            : <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }} data-testid="authority-text">{text}</pre>}
          {hazards.filter((h) => h.imageUrl).length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {hazards.map((h, i) => h.imageUrl && (
                <figure key={h.id} style={{ margin: 0, width: 150 }}>
                  <img src={h.imageUrl} alt="" style={{ width: '100%', borderRadius: 6 }} onError={(e) => { e.target.parentNode.style.display = 'none'; }} />
                  <figcaption style={{ fontSize: '.75rem' }}>{i + 1}</figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
