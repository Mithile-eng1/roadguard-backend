import React, { useRef, useState } from 'react';
import { adminBoxesSet, adminBoxesScore } from '../services/routeService';

// Admin draws the true boxes on a driver's photo (drag with mouse or finger), saves them, and scores the detector on them.
// Boxes are [x, y, w, h] as fractions of the image, so they do not depend on the screen size.
export default function BoxEditor({ backendUrl, token, photo, category: cat0, saved, onClose, onSaved }) {
  const base = backendUrl.replace(/\/$/, '');
  const [category, setCategory] = useState(saved?.category || cat0);
  const [boxes, setBoxes] = useState(saved?.boxes || []);
  const [drag, setDrag] = useState(null);
  const [res, setRes] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const area = useRef(null);

  const pt = (e) => { const r = area.current.getBoundingClientRect(); return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))]; };
  const down = (e) => { e.currentTarget.setPointerCapture(e.pointerId); const [x, y] = pt(e); setDrag({ x0: x, y0: y, x1: x, y1: y }); setRes(null); };
  const move = (e) => { if (drag) { const [x, y] = pt(e); setDrag({ ...drag, x1: x, y1: y }); } };
  const up = () => {
    if (!drag) return;
    const b = [Math.min(drag.x0, drag.x1), Math.min(drag.y0, drag.y1), Math.abs(drag.x1 - drag.x0), Math.abs(drag.y1 - drag.y0)];
    if (b[2] > 0.01 && b[3] > 0.01) setBoxes([...boxes, b]);
    setDrag(null);
  };
  const rect = (b, style) => <div key={style.key} style={{ position: 'absolute', left: `${b[0] * 100}%`, top: `${b[1] * 100}%`, width: `${b[2] * 100}%`, height: `${b[3] * 100}%`, boxSizing: 'border-box', pointerEvents: 'none', ...style.css }} />;

  const save = async () => { await adminBoxesSet(backendUrl, token, { photo, category, boxes }); onSaved(); };
  const run = async (fn) => { setBusy(true); setMsg(''); try { await fn(); } catch (e) { setMsg(e.message); } setBusy(false); };
  const score = () => run(async () => { await save(); setRes(await adminBoxesScore(backendUrl, token, photo)); });

  return (
    <div role="dialog" aria-label="Draw boxes" style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,.75)', display: 'grid', placeItems: 'start center', padding: 12, overflow: 'auto' }}>
      <div style={{ background: 'var(--bg-card, #fff)', color: 'inherit', borderRadius: 12, padding: 14, maxWidth: 760, width: '100%', display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <b>Draw a box around every real hazard</b>
          <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: 'auto' }}>
            <option value="pothole">Pothole</option><option value="speedbreaker">Speed breaker</option>
          </select>
          <button type="button" className="btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={onClose}>Close</button>
        </div>
        <div ref={area} data-testid="box-area" onPointerDown={down} onPointerMove={move} onPointerUp={up}
          style={{ position: 'relative', lineHeight: 0, touchAction: 'none', cursor: 'crosshair', userSelect: 'none' }}>
          <img src={base + photo} alt="" draggable={false} style={{ width: '100%', display: 'block', borderRadius: 6 }} />
          {boxes.map((b, i) => rect(b, { key: 'b' + i, css: { border: '3px solid #22c55e' } }))}
          {drag && rect([Math.min(drag.x0, drag.x1), Math.min(drag.y0, drag.y1), Math.abs(drag.x1 - drag.x0), Math.abs(drag.y1 - drag.y0)], { key: 'd', css: { border: '2px dashed #fff' } })}
          {res && res.detections.map((d, i) => rect(d.box, { key: 'm' + i, css: { border: `3px dashed ${d.hit ? '#3b82f6' : '#ef4444'}` } }))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span data-testid="box-count">{boxes.length} box(es) drawn</span>
          <button type="button" className="btn-secondary btn-sm" disabled={!boxes.length} onClick={() => { setBoxes(boxes.slice(0, -1)); setRes(null); }}>Undo</button>
          <button type="button" className="btn-secondary btn-sm" disabled={!boxes.length} onClick={() => { setBoxes([]); setRes(null); }}>Clear</button>
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => run(async () => { await save(); setMsg('Saved'); })}>Save boxes</button>
          <button type="button" className="btn-action-primary" disabled={busy || !boxes.length} onClick={score}>Score the model</button>
        </div>
        {res && (
          <div data-testid="box-score" style={{ lineHeight: 1.5 }}>
            The model found <b>{res.found} of {res.drawn}</b> drawn hazards (missed {res.missed}, {res.extra} extra detection(s), confidence ≥ {res.conf}).
            <br /><small><span style={{ color: '#22c55e' }}>■</span> your boxes · <span style={{ color: '#3b82f6' }}>■</span> model, correct · <span style={{ color: '#ef4444' }}>■</span> model, wrong</small>
          </div>
        )}
        {msg && <div role="status">{msg}</div>}
      </div>
    </div>
  );
}
