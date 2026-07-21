import React, { useState } from 'react';
import { createLogger } from '@/lib/logger';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { BookOpen, Download, ChevronRight } from 'lucide-react';
import { manualChapters, ManualChapter, ManualSection } from '@/data/userManualContent';
import { generateUserManualPDF } from '@/utils/pdf/userManualPdfGenerator';
import { toast } from 'sonner';

const logger = createLogger('UserManual');

const UserManual: React.FC = () => {
  const [activeChapterId, setActiveChapterId] = useState<string>(manualChapters[0].id);
  const [activeSectionId, setActiveSectionId] = useState<string>(manualChapters[0].sections[0].id);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const activeChapter = manualChapters.find(c => c.id === activeChapterId) ?? manualChapters[0];
  const activeSection = activeChapter.sections.find(s => s.id === activeSectionId) ?? activeChapter.sections[0];

  const handleChapterSelect = (chapter: ManualChapter) => {
    setActiveChapterId(chapter.id);
    setActiveSectionId(chapter.sections[0].id);
  };

  const handleSectionSelect = (section: ManualSection) => {
    setActiveSectionId(section.id);
  };

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    try {
      generateUserManualPDF();
      toast.success('PDF generado correctamente');
    } catch (err) {
      logger.error('Error generating PDF:', err);
      toast.error('Error al generar el PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="space-y-6 pb-6">
      <PageHeader
        title="Manual de Usuario NTMS"
        description="Guía completa del sistema de gestión de grúas y asistencia vial."
        actions={
          <Button
            onClick={handleDownloadPDF}
            disabled={isGeneratingPDF}
            className="flex items-center gap-2"
          >
            <Download className="size-4" />
            {isGeneratingPDF ? 'Generando...' : 'Descargar PDF'}
          </Button>
        }
      />

      <div className="flex flex-col gap-4 h-auto sm:flex-row sm:gap-6 sm:h-[calc(100vh-220px)]">
        {/* Sidebar de navegación */}
        <div className="hidden sm:block w-64 shrink-0">
          <ScrollArea className="h-full rounded-xl border border-border/70 bg-card/80">
            <div className="p-3">
              {manualChapters.map((chapter) => (
                <div key={chapter.id} className="mb-1">
                  <button
                    onClick={() => handleChapterSelect(chapter)}
                    className={cn(
                      'w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                      activeChapterId === chapter.id
                        ? 'text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                    style={activeChapterId === chapter.id ? { backgroundColor: chapter.color } : {}}
                  >
                    <BookOpen className="size-3.5 shrink-0" />
                    <span className="leading-tight">Cap. {chapter.number}</span>
                    <ChevronRight className={cn('size-3 ml-auto shrink-0 transition-transform', activeChapterId === chapter.id && 'rotate-90')} />
                  </button>

                  {activeChapterId === chapter.id && (
                    <div className="ml-3 mt-1 space-y-0.5">
                      {chapter.sections.map((section) => (
                        <button
                          key={section.id}
                          onClick={() => handleSectionSelect(section)}
                          className={cn(
                            'w-full text-left px-3 py-1.5 rounded-md text-xs transition-colors',
                            activeSectionId === section.id
                              ? 'font-medium'
                              : 'text-muted-foreground hover:bg-muted'
                          )}
                          style={activeSectionId === section.id ? { color: chapter.color, backgroundColor: chapter.softColor } : {}}
                        >
                          {section.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Contenido */}
        <div className="flex-1 min-w-0">
          <ScrollArea className="h-[60vh] sm:h-full rounded-xl border border-border/70 bg-card/80">
            <div className="p-8 max-w-3xl">
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-4"
                style={{ backgroundColor: activeChapter.softColor, color: activeChapter.color }}
              >
                <BookOpen className="size-3" />
                Capítulo {activeChapter.number} — {activeChapter.title}
              </div>

              <h1 className="text-2xl font-semibold text-foreground mb-2">
                {activeSection.title}
              </h1>
              <div className="h-0.5 w-16 rounded mb-6" style={{ backgroundColor: activeChapter.color }} />

              <div className="space-y-4 text-sm text-foreground/80 leading-relaxed">
                {activeSection.content.split('\n').filter(p => p.trim() !== '').map((paragraph, idx) => (
                  <p key={idx}>{paragraph}</p>
                ))}
              </div>

              <div className="flex items-center justify-between mt-12 pt-6 border-t border-border/50">
                {(() => {
                  const allSections = activeChapter.sections;
                  const currentIdx = allSections.findIndex(s => s.id === activeSectionId);
                  const prev = currentIdx > 0 ? allSections[currentIdx - 1] : null;
                  const next = currentIdx < allSections.length - 1 ? allSections[currentIdx + 1] : null;
                  return (
                    <>
                      {prev ? (
                        <Button variant="outline" size="sm" onClick={() => setActiveSectionId(prev.id)}>
                          ← {prev.title}
                        </Button>
                      ) : <div />}
                      {next ? (
                        <Button variant="outline" size="sm" onClick={() => setActiveSectionId(next.id)}>
                          {next.title} →
                        </Button>
                      ) : <div />}
                    </>
                  );
                })()}
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
};

export default UserManual;
