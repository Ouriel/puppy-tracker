import React, { useState, useMemo } from "react";
import type { Activity } from "../../types";
import { Pill, Plus, Trash2, Calendar, User } from "lucide-react";
import { Card, Button } from "@heroui/react";
import { ConfirmationModal } from "../../components/common/ConfirmationModal";
import { useI18n } from "../../i18n";

interface MedicationSectionProps {
  activities: Activity[];
  onOpenQuickLogModal?: (type: "medication") => void;
  onDeleteActivity?: (id: string) => void;
}

export const MedicationSection: React.FC<MedicationSectionProps> = ({
  activities,
  onOpenQuickLogModal,
  onDeleteActivity,
}) => {
  const { t, lang } = useI18n();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const medicationLogs = useMemo(() => {
    return activities
      .filter((act) => act.type === "medication")
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [activities]);

  const formatLogDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <Card className="bg-slate-900 border border-slate-800 text-slate-100 shadow-xl">
      <Card.Content className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2 min-w-0">
            <Pill className="w-4 h-4 sm:w-5 sm:h-5 text-teal-400 shrink-0" />
            <span className="break-words">{t.health.medicationHistory} ({medicationLogs.length})</span>
          </h3>
          {onOpenQuickLogModal && (
            <Button
              variant="primary"
              size="sm"
              onPress={() => onOpenQuickLogModal("medication")}
              className="bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-sm shrink-0"
            >
              <Plus className="w-4 h-4 mr-1 inline" />
              {t.health.addMedication}
            </Button>
          )}
        </div>

        {medicationLogs.length === 0 ? (
          <div className="text-center py-8 text-slate-400 bg-slate-950/60 rounded-xl border border-dashed border-slate-800 space-y-2">
            <Pill className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs sm:text-sm font-semibold text-slate-300">
              {t.health.noMedicationRecords}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {medicationLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 sm:p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-bold text-teal-300 flex items-center gap-1.5">
                      <Pill className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                      <span>{log.medicationName || t.potty.medication}</span>
                    </span>
                    <span className="text-[11px] text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>{formatLogDate(log.timestamp)}</span>
                    </span>
                  </div>

                  {log.notes && (
                    <p className="text-xs text-slate-300 italic font-mono bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800/80 break-words">
                      "{log.notes}"
                    </p>
                  )}

                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <User className="w-3 h-3 text-slate-500" />
                    <span>{log.loggedBy}</span>
                  </div>
                </div>

                {onDeleteActivity && (
                  <div className="flex items-center justify-end shrink-0">
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(log.id)}
                      aria-label="Delete medication log"
                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-colors"
                      title={t.health.deleteMedicationConfirm}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <ConfirmationModal
          isOpen={!!confirmDeleteId}
          onClose={() => setConfirmDeleteId(null)}
          onConfirm={() => {
            if (confirmDeleteId && onDeleteActivity) {
              onDeleteActivity(confirmDeleteId);
            }
          }}
          title={t.health.deleteMedicationTitle || t.health.deleteMedicationConfirm}
          message={t.potty.deleteActivityMessage}
        />
      </Card.Content>
    </Card>
  );
};
