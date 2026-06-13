import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { 
  Cloud, 
  Download, 
  HardDrive,
  ExternalLink,
  CheckCircle,
  Info
} from "lucide-react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CloudBackupModal = ({ open, onClose }) => {
  const [downloading, setDownloading] = useState(false);

  const handleDownloadBackup = async () => {
    setDownloading(true);
    try {
      const response = await fetch(`${API}/export/customers/xlsx`, {
        credentials: "include"
      });
      
      if (!response.ok) throw new Error("Download failed");
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `crm_backup_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      
      toast.success("Yedek dosyası indirildi");
    } catch (error) {
      toast.error("İndirme başarısız");
      console.error(error);
    } finally {
      setDownloading(false);
    }
  };

  const openGoogleDrive = () => {
    window.open("https://drive.google.com/drive/my-drive", "_blank");
  };

  const openOneDrive = () => {
    window.open("https://onedrive.live.com", "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" data-testid="cloud-backup-modal">
        <DialogHeader className="pb-4 border-b border-slate-200">
          <DialogTitle className="flex items-center gap-3 text-xl font-semibold">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Cloud className="w-5 h-5 text-blue-700" />
            </div>
            Cloud Yedekleme
          </DialogTitle>
        </DialogHeader>

        <div className="py-6 space-y-6">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-800 mb-2">Cloud Depolama Nasıl Yedeklenir?</h4>
                <ol className="text-sm text-blue-700 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center text-xs font-semibold shrink-0">1</span>
                    <span>Aşağıdaki "Yedek Dosyasını İndir" butonuna tıklayın</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center text-xs font-semibold shrink-0">2</span>
                    <span>.xlsx formatında yedek dosyası indirilecek</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center text-xs font-semibold shrink-0">3</span>
                    <span>İndirilen dosyayı Google Drive veya OneDrive'a yükleyin</span>
                  </li>
                </ol>
              </div>
            </div>
          </div>

          {/* Download Button */}
          <Button
            onClick={handleDownloadBackup}
            disabled={downloading}
            className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white"
            data-testid="btn-download-backup"
          >
            <Download className="w-5 h-5 mr-3" />
            {downloading ? "İndiriliyor..." : "Yedek Dosyasını İndir (.xlsx)"}
          </Button>

          {/* Cloud Storage Options */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={openGoogleDrive}
              className="flex items-center justify-center gap-3 p-4 border-2 border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all"
              data-testid="btn-google-drive"
            >
              <svg className="w-8 h-8" viewBox="0 0 87.3 78">
                <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 13.75z" fill="#ea4335"/>
                <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
              </svg>
              <div className="text-left">
                <p className="font-medium text-slate-900">Google Drive</p>
                <p className="text-xs text-slate-500">Yükle</p>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-400" />
            </button>

            <button
              onClick={openOneDrive}
              className="flex items-center justify-center gap-3 p-4 border-2 border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all"
              data-testid="btn-onedrive"
            >
              <svg className="w-8 h-8" viewBox="0 0 24 24">
                <path fill="#0364B8" d="M14.5 15.9l-5.3-4.4 5.5-2.3c.6.3 1.1.8 1.4 1.4l2.9 5.3h-4.5z"/>
                <path fill="#0078D4" d="M9.2 11.5l5.3 4.4H4.6c-1.2 0-2.1-.9-2.1-2.1 0-.8.5-1.5 1.2-1.9.7-.4 1.6-.4 2.3-.1l3.2 0z"/>
                <path fill="#1490DF" d="M14.7 9.2l-5.5 2.3-3.2 0c.2-.5.5-.9.9-1.3.7-.7 1.7-1 2.7-.9l5.1 0v-.1z"/>
                <path fill="#28A8EA" d="M19.8 15.9h-5.3l-5.3-4.4h5.3c.8 0 1.5.2 2.1.6l.4.3 2.8 3.5z"/>
              </svg>
              <div className="text-left">
                <p className="font-medium text-slate-900">OneDrive</p>
                <p className="text-xs text-slate-500">Yükle</p>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {/* Success message */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-slate-700">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <span className="text-sm">
                Yedek dosyalarınız her zaman <strong>.xlsx</strong> formatında indirilir ve tüm müşteri bilgilerinizi içerir.
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-200 flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Kapat
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CloudBackupModal;
