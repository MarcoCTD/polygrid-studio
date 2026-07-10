/**
 * Print-Portal (Modul 17, PDF-Weg 1): rendert das Dokument in einen
 * Portal-Container außerhalb von #root und öffnet den Systemdruckdialog
 * (macOS: "Als PDF sichern"). Das Print-Stylesheet blendet währenddessen
 * die App aus und zeigt nur das Blatt.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { DocumentSnapshot } from '../../schemas';
import { DocumentSheet } from './DocumentSheet';

/** Schutz gegen doppelte print()-Aufrufe (React-StrictMode-Doppeleffekt). */
let printInFlight = false;

export function DocumentPrintPortal({
  snapshot,
  onDone,
}: {
  snapshot: DocumentSnapshot;
  onDone: () => void;
}) {
  const [container] = useState(() => {
    const element = document.createElement('div');
    element.id = 'pg-print-root';
    return element;
  });
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    document.body.appendChild(container);
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      printInFlight = false;
      onDoneRef.current();
    };

    window.addEventListener('afterprint', finish);
    // Zwei Frames warten, damit das Blatt fertig gelayoutet ist.
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (printInFlight) return;
        printInFlight = true;
        try {
          window.print();
        } catch (error) {
          console.error('[Documents] Druckdialog konnte nicht geöffnet werden', error);
        }
        // window.print() blockiert bis der Dialog geschlossen ist;
        // afterprint dient als Fallback für abweichende Webviews.
        finish();
      });
    });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('afterprint', finish);
      container.remove();
      printInFlight = false;
    };
  }, [container]);

  return createPortal(<DocumentSheet snapshot={snapshot} className="shadow-none" />, container);
}
