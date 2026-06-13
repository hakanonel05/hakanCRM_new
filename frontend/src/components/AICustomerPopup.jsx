import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Sparkles, X, Loader2, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AICustomerPopup = ({ customer, isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  const fetchSummary = useCallback(async () => {
    if (!customer?.id) return;
    
    setLoading(true);
    setError(null);
    setSummary(null);
    
    try {
      const response = await axios.post(`${API}/ai/customer-summary`, {
        customer_id: customer.id
      });
      setSummary(response.data.summary);
    } catch (err) {
      console.error("AI Summary error:", err);
      setError(err.response?.data?.detail || "Özet oluşturulamadı");
    } finally {
      setLoading(false);
    }
  }, [customer?.id]);

  // Fetch summary when dialog opens with a new customer
  useEffect(() => {
    if (isOpen && customer?.id) {
      setSummary(null);
      setError(null);
      fetchSummary();
    }
  }, [isOpen, customer?.id, fetchSummary]);

  const handleClose = () => {
    setSummary(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="text-lg">AI Müşteri Özeti</span>
              <p className="text-sm font-normal text-slate-500">{customer?.company_name}</p>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Müşteri hakkında AI tarafından oluşturulan özet
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin mb-3 text-purple-500" />
              <p className="text-sm">AI özet hazırlanıyor...</p>
              <p className="text-xs text-slate-400 mt-1">Gemini 2.5 Flash</p>
            </div>
          ) : error ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <X className="w-6 h-6 text-red-500" />
              </div>
              <p className="text-red-600 text-sm mb-3">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchSummary}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Tekrar Dene
              </Button>
            </div>
          ) : summary ? (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-100">
                <div className="prose prose-sm prose-slate max-w-none">
                  {summary.split('\n').map((line, idx) => (
                    <p key={idx} className="text-slate-700 text-sm leading-relaxed mb-2 last:mb-0">
                      {line}
                    </p>
                  ))}
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-2">
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Gemini 2.5 Flash ile oluşturuldu
                </span>
                <Button variant="ghost" size="sm" onClick={fetchSummary} className="h-7 text-xs">
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Yenile
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-slate-500">
              <Sparkles className="w-8 h-8 mb-3 text-purple-300" />
              <p className="text-sm">Özet yükleniyor...</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AICustomerPopup;
