export interface DownloadTextFileOptions {
  content: string;
  fileName: string;
  contentType: string;
}

const DOWNLOAD_URL_REVOKE_DELAY = 30_000;

export const downloadTextFile = ({ content, fileName, contentType }: DownloadTextFileOptions) => {
  const blob = new Blob([content], { type: contentType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, DOWNLOAD_URL_REVOKE_DELAY);
};

export const triggerFileDownload = (url: string, fileName: string) => {
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};