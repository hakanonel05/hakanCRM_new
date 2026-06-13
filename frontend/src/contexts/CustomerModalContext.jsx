import React, { createContext, useContext, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { X, ExternalLink } from "lucide-react";
import CustomerDetailPage from "../pages/CustomerDetailPage";

const CustomerModalContext = createContext(null);

export const useCustomerModal = () => {
  const ctx = useContext(CustomerModalContext);
  if (!ctx) {
    // Graceful fallback so unwrapped components don't crash — fall back to navigation
    return {
      openCustomerModal: () => {},
      closeCustomerModal: () => {},
    };
  }
  return ctx;
};

export const CustomerModalProvider = ({ children }) => {
  const [customerId, setCustomerId] = useState(null);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const openCustomerModal = useCallback((id) => {
    if (!id) return;
    setCustomerId(id);
    setOpen(true);
  }, []);

  const closeCustomerModal = useCallback(() => {
    setOpen(false);
    // Clear customerId after close animation
    setTimeout(() => setCustomerId(null), 150);
  }, []);

  const goToFullPage = useCallback(() => {
    if (customerId) {
      const id = customerId;
      setOpen(false);
      setTimeout(() => {
        setCustomerId(null);
        navigate(`/customers/${id}`);
      }, 100);
    }
  }, [customerId, navigate]);

  return (
    <CustomerModalContext.Provider value={{ openCustomerModal, closeCustomerModal }}>
      {children}

      <Dialog open={open} onOpenChange={(o) => { if (!o) closeCustomerModal(); }}>
        <DialogContent
          className="max-w-[1200px] w-[95vw] h-[92vh] p-0 overflow-hidden flex flex-col gap-0"
          aria-describedby={undefined}
        >
          {/* Top bar with Full Page + Close */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/40 backdrop-blur z-10">
            <div className="text-xs text-muted-foreground font-medium">Müşteri Detayı</div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 text-muted-foreground hover:text-foreground"
                onClick={goToFullPage}
                title="Tam sayfa görünümünde aç"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                Tam Sayfa
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                onClick={closeCustomerModal}
                title="Kapat"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Scrollable content area — renders CustomerDetailPage in modal mode */}
          <div className="flex-1 overflow-y-auto">
            {customerId && (
              <CustomerDetailPage
                customerId={customerId}
                isModal={true}
                onClose={closeCustomerModal}
                onNavigateToFull={goToFullPage}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </CustomerModalContext.Provider>
  );
};
