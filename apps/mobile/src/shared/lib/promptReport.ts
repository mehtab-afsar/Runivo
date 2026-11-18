import { } from 'react-native';
import { appAlert } from '@mobile/shared/components/AppAlert';
import { reportContent, REPORT_REASONS, type ReportableContent, type ReportReason } from '../services/safetyService';

const ASKED: ReportReason[] = ['harassment', 'spam', 'inappropriate', 'other'];

/**
 * Ask why, send the report, say thanks. One flow for every kind of content so
 * the wording and behaviour are the same wherever someone taps "Report"
 * (App Store Guideline 1.2: a visible way to report objectionable content).
 */
export function promptReport(type: ReportableContent, id: string, noun: string): void {
  const send = async (reason: ReportReason) => {
    try {
      await reportContent(type, id, reason);
      appAlert('Thanks, we got it', 'We review every report and act within 24 hours if it breaks our rules.');
    } catch {
      appAlert("Couldn't send the report", 'Check your connection and try again.');
    }
  };
  appAlert(`Report this ${noun}`, 'What is wrong with it?', [
    ...REPORT_REASONS.filter(r => ASKED.includes(r.id)).map(r => ({ text: r.label, onPress: () => { send(r.id); } })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}
