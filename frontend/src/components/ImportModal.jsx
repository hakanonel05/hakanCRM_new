import { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import { Checkbox } from "./ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { 
  Upload, 
  FileSpreadsheet, 
  Building2,
  Calendar,
  ArrowLeft,
  Download,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Lightbulb,
  X,
  Copy,
  Plus,
  Loader2,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ImportModal = ({ open, onClose, onImportComplete }) => {
  const companyFileRef = useRef(null);
  const visitFileRef = useRef(null);
  const [step, setStep] = useState("select"); // select, company, visit, preview
  const [importType, setImportType] = useState(null); // company or visit
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState("");
  const [importing, setImporting] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  
  // Progress tracking
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importStatus, setImportStatus] = useState(""); // "importing", "success", "error"
  // Live counters shown DURING import (updated after every chunk)
  const [importLive, setImportLive] = useState({ added: 0, updated: 0, failed: 0 });
  // Final summary shown AFTER import: {added, updated, failed, skipped}
  const [importResult, setImportResult] = useState(null);
  
  // Preview state
  const [previewData, setPreviewData] = useState([]);
  const [similarityWarnings, setSimilarityWarnings] = useState([]);
  const [skipItems, setSkipItems] = useState(new Set());
  const [updateItems, setUpdateItems] = useState(new Map()); // rowNum -> existingCustomerId
  const [parseErrors, setParseErrors] = useState([]);
  const [checkingSimilarity, setCheckingSimilarity] = useState(false);
  const [previewStats, setPreviewStats] = useState({ new: 0, similar: 0, duplicate: 0 });
  const [processingFile, setProcessingFile] = useState(false); // Dosya işleniyor mu?

  useEffect(() => {
    if (open) {
      fetchCustomers();
      resetState();
    }
  }, [open]);

  const fetchCustomers = async () => {
    try {
      // Need all customers for similarity check
      const response = await axios.get(`${API}/customers?limit=5000`);
      // Handle paginated response format
      if (response.data && response.data.data) {
        setCustomers(response.data.data);
      } else if (Array.isArray(response.data)) {
        setCustomers(response.data);
      } else {
        setCustomers([]);
      }
    } catch (error) {
      console.error("Müşteriler yüklenirken hata:", error);
      setCustomers([]);
    }
  };

  const resetState = () => {
    setStep("select");
    setImportType(null);
    setSelectedFile(null);
    setFileContent("");
    setPreviewData([]);
    setSimilarityWarnings([]);
    setSkipItems(new Set());
    setUpdateItems(new Map());
    setParseErrors([]);
    setSelectedCustomerId("");
    setCheckingSimilarity(false);
    setPreviewStats({ new: 0, similar: 0, duplicate: 0 });
    setImportProgress({ current: 0, total: 0 });
    setImportStatus("");
    setImportLive({ added: 0, updated: 0, failed: 0 });
    setImportResult(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleTypeSelect = (type) => {
    setImportType(type);
    setStep(type);
  };

  const handleBack = () => {
    if (step === "preview") {
      setStep(importType);
      setPreviewData([]);
      setSimilarityWarnings([]);
      setParseErrors([]);
    } else {
      setStep("select");
      setImportType(null);
    }
  };

  // Download templates from backend (XLSX format)
  const downloadCompanyTemplate = async () => {
    try {
      const response = await fetch(`${API}/export/customers/template`, {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Download failed");
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'sirket_sablonu.xlsx';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("Şablon indirilemedi");
    }
  };

  const downloadVisitTemplate = async () => {
    try {
      const response = await fetch(`${API}/export/visits/template`, {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Download failed");
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'ziyaret_sablonu.xlsx';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("Şablon indirilemedi");
    }
  };

  // File handling - supports both CSV and XLSX
  const handleFileSelect = async (e) => {
    console.log("File select triggered", e.target.files);
    const file = e.target.files?.[0];
    if (!file) {
      console.log("No file selected");
      return;
    }
    console.log("File selected:", file.name, file.type, file.size);
    await processFile(file);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const processFile = async (file) => {
    console.log("Processing file:", file.name);
    setSelectedFile(file);
    setProcessingFile(true); // Dosya işlemeye başladı
    
    const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    
    if (isXlsx) {
      // Handle XLSX with xlsx library
      try {
        const XLSX = await import('xlsx');
        console.log("XLSX library loaded");
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const csvContent = XLSX.utils.sheet_to_csv(worksheet);
            console.log("CSV content generated, rows:", csvContent.split('\n').length);
            setFileContent(csvContent);
            await parseAndPreview(csvContent);
          } catch (error) {
            console.error("XLSX parse error:", error);
            toast.error("Excel dosyası okunamadı: " + error.message);
            setProcessingFile(false);
          }
        };
        reader.onerror = (error) => {
          console.error("FileReader error:", error);
          toast.error("Dosya okunamadı");
          setProcessingFile(false);
        };
        reader.readAsArrayBuffer(file);
      } catch (error) {
        console.error("XLSX import error:", error);
        toast.error("Excel kütüphanesi yüklenemedi");
        setProcessingFile(false);
      }
    } else {
      // Handle CSV
      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target.result;
        console.log("CSV content loaded, length:", content.length);
        setFileContent(content);
        await parseAndPreview(content);
      };
      reader.onerror = (error) => {
        console.error("FileReader error:", error);
        toast.error("Dosya okunamadı");
        setProcessingFile(false);
      };
      reader.readAsText(file, 'UTF-8');
    }
  };

  const parseAndPreview = async (content) => {
    const lines = content.trim().split('\n');
    if (lines.length < 2) {
      setParseErrors(['Dosyada yeterli veri bulunamadı']);
      setProcessingFile(false);
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const errors = [];
    const parsed = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      
      if (importType === 'company') {
        const customer = parseCompanyRow(headers, values, i + 1, errors);
        if (customer) parsed.push(customer);
      } else {
        const visit = parseVisitRow(headers, values, i + 1, errors);
        if (visit) parsed.push(visit);
      }
    }

    setParseErrors(errors);
    setPreviewData(parsed);
    setProcessingFile(false); // Dosya işleme tamamlandı

    // Check similarity for companies
    if (importType === 'company' && parsed.length > 0) {
      await checkSimilarities(parsed);
    }

    setStep('preview');
  };

  const parseCSVLine = (line) => {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  };

  const parseCompanyRow = (headers, values, rowNum, errors) => {
    const getVal = (name) => {
      const idx = headers.findIndex(h => h.toLowerCase().trim().includes(name.toLowerCase()));
      return idx >= 0 ? values[idx]?.replace(/"/g, '').trim() || '' : '';
    };

    const companyName = getVal('firma') || getVal('şirket') || getVal('company') || values[0]?.replace(/"/g, '');
    
    if (!companyName) {
      errors.push(`Satır ${rowNum}: Eksik zorunlu alan - Firma Adı`);
      return null;
    }

    return {
      rowNum,
      company_name: companyName,
      market: getVal('market'),
      application: getVal('uygulama') || getVal('application'),
      city: getVal('şehir') || getVal('city'),
      district: getVal('ilçe') || getVal('district'),
      website: getVal('web') || getVal('website'),
      status: getVal('durum') || getVal('status') || 'Beklemede',
      contact_info: {
        contact_person: getVal('kişi') || getVal('contact') || getVal('iletişim'),
        email: getVal('mail') || getVal('e-posta'),
        phone: getVal('telefon') || getVal('phone')
      },
      competitor: getVal('rakip') || getVal('competitor'),
      partner: getVal('partner'),
      potential_level: getVal('potansiyel') || 'Düşük',
      assigned_to: getVal('takip') || getVal('assigned'),
      products: (getVal('ürün') || getVal('product') || getVal('abb')).split(',').filter(Boolean).map(p => p.trim()),
      notes: getVal('notlar') || getVal('notes') || getVal('not'),
      tags: [],
      is_followup: false,
      potential_value: 0,
      description: ''
    };
  };

  const parseVisitRow = (headers, values, rowNum, errors) => {
    const getVal = (name) => {
      const idx = headers.findIndex(h => h.toLowerCase().trim().includes(name.toLowerCase()));
      return idx >= 0 ? values[idx]?.replace(/"/g, '').trim() || '' : '';
    };

    const visitDate = getVal('tarih') || getVal('date') || values[0]?.replace(/"/g, '');
    
    if (!visitDate) {
      errors.push(`Satır ${rowNum}: Eksik zorunlu alan - Ziyaret Tarihi`);
      return null;
    }

    return {
      rowNum,
      customer_id: selectedCustomerId,
      visit_date: visitDate,
      visited_by: getVal('ziyaret eden') || getVal('visited') || getVal('yapan') || '',
      visit_type: getVal('tip') || getVal('type') || 'Yüz Yüze',
      contact_person: getVal('görüşülen') || getVal('contact') || getVal('kişi') || '',
      outcome: getVal('sonuç') || getVal('outcome'),
      next_visit_date: getVal('sonraki') || getVal('next'),
      notes: getVal('notlar') || getVal('notes') || getVal('not'),
      is_followup: false
    };
  };

  const checkSimilarities = async (data) => {
    if (importType !== 'company') return;
    
    setCheckingSimilarity(true);
    
    try {
      // Prepare rows for backend preview endpoint
      const rows = data.map((item, idx) => ({
        row_num: idx + 1,
        company_name: item.company_name,
        market: item.market || "",
        application: item.application || "",
        city: item.city || "",
        district: item.district || "",
        website: item.website || "",
        status: item.status || "Beklemede",
        contact_person: item.contact_info?.contact_person || "",
        email: item.contact_info?.email || "",
        phone: item.contact_info?.phone || "",
        competitor: item.competitor || "",
        partner: item.partner || "",
        potential_level: item.potential_level || "Düşük",
        assigned_to: item.assigned_to || "",
        products: (item.products || []).join(","),
        notes: item.notes || ""
      }));

      const response = await axios.post(`${API}/import/preview`, { rows });
      const result = response.data;
      
      // Update preview data with similarity info
      const updatedData = data.map((item, idx) => {
        const rowNum = idx + 1;
        const previewItem = result.items.find(p => p.row_num === rowNum);
        return {
          ...item,
          rowNum: rowNum,
          similarity_status: previewItem?.similarity_status || "new",
          similar_customers: previewItem?.similar_customers || []
        };
      });
      
      setPreviewData(updatedData);
      setPreviewStats({
        new: result.total_new,
        similar: result.total_similar,
        duplicate: result.total_duplicate
      });
      
      // Auto-skip duplicates
      const duplicateRows = new Set();
      updatedData.forEach(item => {
        if (item.similarity_status === "duplicate") {
          duplicateRows.add(item.rowNum);
        }
      });
      setSkipItems(duplicateRows);
      
      // Build warnings for UI
      const warnings = updatedData
        .filter(item => item.similarity_status !== "new" && item.similar_customers?.length > 0)
        .map(item => ({
          rowNum: item.rowNum,
          company_name: item.company_name,
          similarity_status: item.similarity_status,
          similarities: item.similar_customers.map(s => ({
            customer_id: s.customer_id,
            company_name: s.company_name,
            similarity_score: s.similarity_score,
            match_type: s.match_type
          }))
        }));
      
      setSimilarityWarnings(warnings);
      
    } catch (error) {
      console.error('Benzerlik kontrolü hatası:', error);
      // Fallback to old method
      const warnings = [];
      for (const item of data) {
        try {
          const response = await axios.post(`${API}/customers/check-similarity`, {
            company_name: item.company_name,
            website: item.website,
            contact_info: item.contact_info
          });
          
          if (response.data.length > 0) {
            warnings.push({
              rowNum: item.rowNum,
              company_name: item.company_name,
              similarity_status: response.data[0].similarity_score >= 95 ? "duplicate" : "similar",
              similarities: response.data
            });
          }
        } catch (err) {
          console.error('Benzerlik kontrolü hatası:', err);
        }
      }
      setSimilarityWarnings(warnings);
    } finally {
      setCheckingSimilarity(false);
    }
  };

  const toggleSkip = (rowNum) => {
    const newSkip = new Set(skipItems);
    if (newSkip.has(rowNum)) {
      newSkip.delete(rowNum);
    } else {
      newSkip.add(rowNum);
    }
    setSkipItems(newSkip);
  };

  const handleImport = async () => {
    setImporting(true);
    setImportStatus("importing");

    const itemsToImport = previewData.filter(item => !skipItems.has(item.rowNum));
    const total = itemsToImport.length;
    setImportProgress({ current: 0, total });

    try {
      if (importType === 'company') {
        // Separate new items and merge items
        const newItems = [];
        const mergeItems = [];
        
        for (const item of itemsToImport) {
          const { rowNum, similarity_status, similar_customers, ...customerData } = item;
          const targetCustomerId = updateItems.get(rowNum);
          
          if (targetCustomerId) {
            mergeItems.push({ customer_id: targetCustomerId, data: customerData });
          } else {
            newItems.push(customerData);
          }
        }

        // Step 1: Collect all unique options and bulk-create them first
        setImportProgress({ current: 0, total: total + 1 }); // +1 for options step
        const optionFields = ['market', 'application', 'city', 'competitor', 'partner'];
        const allOptions = [];
        const seenOptions = new Set();
        
        for (const item of itemsToImport) {
          for (const field of optionFields) {
            const value = item[field];
            if (value) {
              const key = `${field}:${value.toLowerCase()}`;
              if (!seenOptions.has(key)) {
                seenOptions.add(key);
                allOptions.push({ field_name: field, value });
              }
            }
          }
        }
        
        if (allOptions.length > 0) {
          try {
            await axios.post(`${API}/options/bulk`, { options: allOptions });
          } catch (e) {
            console.warn('Bulk options warning:', e);
          }
        }
        setImportProgress({ current: 1, total: total + 1 });

        // Step 2: Bulk import customers in chunks.
        // Smaller chunks = more frequent progress updates, so the user SEES
        // things moving instead of a bar stuck at 0% for a minute.
        const CHUNK_SIZE = 25;
        let successCount = 0;
        let failCount = 0;
        let mergeCount = 0;
        setImportLive({ added: 0, updated: 0, failed: 0 });

        // Process new items in chunks
        for (let i = 0; i < newItems.length; i += CHUNK_SIZE) {
          const chunk = newItems.slice(i, i + CHUNK_SIZE);

          try {
            const response = await axios.post(`${API}/import/bulk-customers`, {
              items: chunk,
              merge_items: i === 0 ? mergeItems : []
            });
            successCount += response.data.success || 0;
            mergeCount += response.data.merged || 0;
            failCount += response.data.failed || 0;
          } catch (error) {
            console.error('Chunk import hatası:', error);
            failCount += chunk.length;
          }

          const processed = Math.min(i + CHUNK_SIZE, newItems.length) + (i === 0 ? mergeItems.length : 0);
          setImportProgress({ current: 1 + processed, total: total + 1 });
          setImportLive({ added: successCount, updated: mergeCount, failed: failCount });
        }

        // If no new items but merge items exist
        if (newItems.length === 0 && mergeItems.length > 0) {
          try {
            const response = await axios.post(`${API}/import/bulk-customers`, {
              items: [],
              merge_items: mergeItems
            });
            mergeCount += response.data.merged || 0;
            failCount += response.data.failed || 0;
          } catch (error) {
            console.error('Merge import hatası:', error);
            failCount += mergeItems.length;
          }
          setImportLive({ added: successCount, updated: mergeCount, failed: failCount });
        }

        setImportProgress({ current: total + 1, total: total + 1 });
        setImporting(false);
        setImportStatus(failCount === 0 ? "success" : "error");

        const skippedCount = skipItems.size;
        // Instant toast with full counts
        const parts = [];
        if (successCount > 0) parts.push(`${successCount} yeni eklendi`);
        if (mergeCount > 0) parts.push(`${mergeCount} güncellendi`);
        if (skippedCount > 0) parts.push(`${skippedCount} atlandı`);
        if (failCount > 0) parts.push(`${failCount} hata`);
        const message = parts.join(", ") || "İşlem tamamlandı";
        if (failCount > 0) {
          toast.error(message);
        } else {
          toast.success(message);
        }

        // Show a persistent summary screen — do NOT auto-close, so the user
        // can clearly see what happened (added / updated / skipped / failed).
        setImportResult({ added: successCount, updated: mergeCount, failed: failCount, skipped: skippedCount });
        if (successCount > 0 || mergeCount > 0) {
          onImportComplete();
        }
      } else {
        // Visit import - still one by one since visits are less common
        let successCount = 0;
        let failCount = 0;
        
        for (let i = 0; i < itemsToImport.length; i++) {
          const { rowNum, ...visitData } = itemsToImport[i];
          setImportProgress({ current: i + 1, total });
          try {
            await axios.post(`${API}/visits`, visitData);
            successCount++;
          } catch (error) {
            failCount++;
            console.error('Visit import hatası:', error);
          }
        }
        
        setImporting(false);
        setImportStatus(failCount === 0 ? "success" : "error");
        setImportProgress({ current: total, total });

        const skippedVisits = skipItems.size;
        const vParts = [];
        if (successCount > 0) vParts.push(`${successCount} ziyaret eklendi`);
        if (skippedVisits > 0) vParts.push(`${skippedVisits} atlandı`);
        if (failCount > 0) vParts.push(`${failCount} hata`);
        const vMessage = vParts.join(", ") || "İşlem tamamlandı";
        if (failCount > 0) {
          toast.error(vMessage);
        } else {
          toast.success(vMessage);
        }
        setImportResult({ added: successCount, updated: 0, failed: failCount, skipped: skippedVisits });
        if (successCount > 0) {
          onImportComplete();
        }
      }
    } catch (error) {
      console.error('Import genel hatası:', error);
      setImporting(false);
      setImportStatus("error");
      toast.error("İçe aktarma sırasında bir hata oluştu");
    }
  };

  // Render functions
  const renderSelectStep = () => (
    <div className="p-6 space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-slate-900">İçe Aktarma Türünü Seçin</h3>
        <p className="text-sm text-slate-500 mt-1">Hangi tür veriyi içe aktarmak istiyorsunuz?</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => handleTypeSelect('company')}
          className="p-6 border-2 border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all text-center group"
          data-testid="btn-import-company"
        >
          <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-200 transition-colors">
            <Building2 className="w-8 h-8 text-blue-600" />
          </div>
          <h4 className="font-semibold text-slate-900">Şirket Verilerini İçe Aktar</h4>
          <p className="text-sm text-slate-500 mt-1">Excel dosyasından şirket bilgilerini toplu olarak ekleyin</p>
        </button>

        <button
          onClick={() => handleTypeSelect('visit')}
          className="p-6 border-2 border-slate-200 rounded-xl hover:border-emerald-400 hover:bg-emerald-50 transition-all text-center group"
          data-testid="btn-import-visit"
        >
          <div className="w-16 h-16 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:bg-emerald-200 transition-colors">
            <Calendar className="w-8 h-8 text-emerald-600" />
          </div>
          <h4 className="font-semibold text-slate-900">Ziyaret Verilerini İçe Aktar</h4>
          <p className="text-sm text-slate-500 mt-1">Mevcut bir şirket için ziyaret raporlarını toplu olarak ekleyin</p>
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Lightbulb className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">İpuçları:</p>
            <ul className="text-sm text-amber-700 mt-1 space-y-1">
              <li>• <strong>Şirket İçe Aktarma:</strong> Yeni müşterileri toplu olarak sisteme eklemek için</li>
              <li>• <strong>Ziyaret İçe Aktarma:</strong> Mevcut bir müşteri için geçmiş ziyaret raporlarını eklemek için</li>
              <li>• Her iki seçenek için de Excel şablonları mevcuttur</li>
              <li>• Dosyalar .xlsx veya .csv formatında olmalıdır</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCompanyStep = () => (
    <div className="p-6 space-y-6">
      {/* Dosya işlenirken loading göstergesi */}
      {processingFile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl text-center">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Dosya İşleniyor...</h3>
            <p className="text-slate-500 mb-2">Excel dosyası okunuyor ve analiz ediliyor</p>
            <p className="text-sm text-slate-400">Bu işlem dosya boyutuna göre biraz zaman alabilir</p>
          </div>
        </div>
      )}

      <div className="text-center">
        <Button onClick={downloadCompanyTemplate} className="bg-primary hover:opacity-90">
          <Download className="w-4 h-4 mr-2" />
          Şirket Şablonu İndir
        </Button>
        <p className="text-sm text-slate-500 mt-2">Excel dosyanızın beklenen formatını görmek için şablonu indirin</p>
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors"
      >
        <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <p className="font-medium text-slate-700">Şirket Excel dosyanızı buraya sürükleyin</p>
        <p className="text-sm text-slate-500 mt-1">veya dosya seçmek için tıklayın</p>
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileSelect}
          className="hidden"
          id="company-file-input"
          data-testid="company-file-input"
        />
        <Button 
          variant="default" 
          className="mt-4 bg-primary hover:opacity-90"
          disabled={processingFile}
          onClick={() => {
            console.log("Dosya Seç button clicked");
            const input = document.getElementById('company-file-input');
            console.log("Input element:", input);
            if (input) {
              input.click();
            } else {
              console.error("Input element not found!");
            }
          }}
        >
          {processingFile ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              İşleniyor...
            </>
          ) : (
            "Dosya Seç"
          )}
        </Button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="font-medium text-blue-800">Excel Dosya Formatı:</p>
        <ul className="text-sm text-blue-700 mt-2 space-y-1">
          <li>• <strong>Zorunlu alan:</strong> Sadece Firma Adı</li>
          <li>• <strong>Desteklenen kolonlar:</strong> Market, Uygulama, Şehir, İlçe, Durum, Rakip, Partner, Potansiyel, Takip Eden, ABB Ürünleri vb.</li>
          <li>• <strong>Potansiyel:</strong> Düşük, Orta veya Yüksek olarak girin</li>
        </ul>
      </div>
    </div>
  );

  const renderVisitStep = () => (
    <div className="p-6 space-y-6">
      <div>
        <Label className="text-base">Ziyaretleri Eklenecek Şirket *</Label>
        <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
          <SelectTrigger className="mt-2" data-testid="select-visit-customer">
            <SelectValue placeholder="Şirket seçin" />
          </SelectTrigger>
          <SelectContent>
            {customers.map((customer) => (
              <SelectItem key={customer.id} value={customer.id}>
                {customer.company_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-slate-500 mt-1">Tüm ziyaretler seçilen şirkete atanacaktır</p>
      </div>

      {selectedCustomerId && (
        <>
          <div className="text-center">
            <Button onClick={downloadVisitTemplate} className="bg-emerald-600 hover:bg-emerald-700">
              <Download className="w-4 h-4 mr-2" />
              Ziyaret Şablonu İndir
            </Button>
            <p className="text-sm text-slate-500 mt-2">Ziyaret verilerinin beklenen formatını görmek için şablonu indirin</p>
          </div>

          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-emerald-400 transition-colors"
          >
            <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="font-medium text-slate-700">Ziyaret Excel dosyanızı buraya sürükleyin</p>
            <p className="text-sm text-slate-500 mt-1">veya dosya seçmek için tıklayın</p>
            <p className="text-sm text-emerald-600 font-medium mt-2">
              Seçilen şirket: {customers.find(c => c.id === selectedCustomerId)?.company_name}
            </p>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
              id="visit-file-input"
            />
            <Button 
              variant="default" 
              className="mt-4 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => document.getElementById('visit-file-input').click()}
            >
              Dosya Seç
            </Button>
          </div>
        </>
      )}
    </div>
  );

  const renderPreviewStep = () => (
    <ScrollArea className="max-h-[60vh]">
      <div className="p-6 space-y-4">
        {/* Import Progress Overlay */}
        {importing && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
              <div className="text-center">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">İçe Aktarılıyor...</h3>
                <p className="text-slate-500 mb-4">Lütfen bu pencereyi kapatmayın</p>
                
                {/* Progress Bar */}
                <div className="w-full bg-slate-200 rounded-full h-4 mb-2 overflow-hidden">
                  <div 
                    className="bg-primary h-full rounded-full transition-all duration-300"
                    style={{ width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-lg font-semibold text-slate-700">
                  %{importProgress.total > 0 ? Math.round((importProgress.current / importProgress.total) * 100) : 0}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  {importProgress.current === 0 ? 'Sunucuya bağlanılıyor... (sunucu uykudaysa ilk yanıt 30-60 sn sürebilir)' :
                   importProgress.current === 1 && importType === 'company' ? 'Seçenekler kaydedildi, müşteriler aktarılıyor...' :
                   importProgress.total > 0 
                    ? `${Math.min(importProgress.current, importProgress.total)} / ${importProgress.total} kayıt işlendi`
                    : 'Hazırlanıyor...'}
                </p>

                {/* Live counters — updates after every batch */}
                {(importLive.added > 0 || importLive.updated > 0 || importLive.failed > 0) && (
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg py-2">
                      <p className="text-lg font-bold text-emerald-700">{importLive.added}</p>
                      <p className="text-[11px] text-emerald-600">Eklendi</p>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg py-2">
                      <p className="text-lg font-bold text-blue-700">{importLive.updated}</p>
                      <p className="text-[11px] text-blue-600">Güncellendi</p>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-lg py-2">
                      <p className="text-lg font-bold text-red-700">{importLive.failed}</p>
                      <p className="text-[11px] text-red-600">Hata</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Final result summary — stays on screen until the user closes it */}
        {!importing && importResult && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl text-center">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${importResult.failed > 0 ? 'bg-amber-100' : 'bg-emerald-100'}`}>
                {importResult.failed > 0 ? (
                  <AlertTriangle className="w-10 h-10 text-amber-600" />
                ) : (
                  <CheckCircle className="w-10 h-10 text-emerald-600" />
                )}
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-1">
                {importResult.failed > 0 ? 'İçe Aktarma Tamamlandı (hatalarla)' : 'İçe Aktarma Tamamlandı'}
              </h3>
              <p className="text-sm text-slate-500 mb-5">İşlem sonucu aşağıda özetlenmiştir</p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl py-3">
                  <p className="text-2xl font-bold text-emerald-700">{importResult.added}</p>
                  <p className="text-xs text-emerald-600">Yeni Eklendi</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl py-3">
                  <p className="text-2xl font-bold text-blue-700">{importResult.updated}</p>
                  <p className="text-xs text-blue-600">Güncellendi</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl py-3">
                  <p className="text-2xl font-bold text-slate-700">{importResult.skipped}</p>
                  <p className="text-xs text-slate-500">Atlandı / Yoksayıldı</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl py-3">
                  <p className="text-2xl font-bold text-red-700">{importResult.failed}</p>
                  <p className="text-xs text-red-600">Hata</p>
                </div>
              </div>

              <Button onClick={handleClose} className="w-full">
                Tamam
              </Button>
            </div>
          </div>
        )}

        {/* Loading state */}
        {checkingSimilarity && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            <div>
              <p className="font-medium text-blue-800">Benzerlik Kontrolü Yapılıyor...</p>
              <p className="text-sm text-blue-600">Mevcut müşterilerle karşılaştırılıyor ({previewData.length} kayıt)</p>
            </div>
          </div>
        )}

        {!checkingSimilarity && !importing && (
          <>
            {/* Stats summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                <Plus className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                <p className="text-lg font-bold text-emerald-700">{previewStats.new}</p>
                <p className="text-xs text-emerald-600">Yeni Şirket</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                <AlertTriangle className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                <p className="text-lg font-bold text-amber-700">{previewStats.similar}</p>
                <p className="text-xs text-amber-600">Benzer Şirket</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                <Copy className="w-5 h-5 text-red-600 mx-auto mb-1" />
                <p className="text-lg font-bold text-red-700">{previewStats.duplicate}</p>
                <p className="text-xs text-red-600">Kopya (Otomatik Atlandı)</p>
              </div>
            </div>

            {/* Import summary */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
              <div>
                <p className="font-medium text-emerald-800">İçe Aktarılacak</p>
                <p className="text-sm text-emerald-600">
                  {previewData.length - skipItems.size} / {previewData.length} {importType === 'company' ? 'şirket' : 'ziyaret'}
                </p>
              </div>
            </div>

            {/* Parse errors */}
            {parseErrors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-800 font-medium mb-2">
                  <AlertCircle className="w-5 h-5" />
                  Format Hataları ({parseErrors.length})
                </div>
                <ul className="text-sm text-red-600 space-y-1">
                  {parseErrors.slice(0, 5).map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                  {parseErrors.length > 5 && (
                    <li>...ve {parseErrors.length - 5} daha</li>
                  )}
                </ul>
              </div>
            )}

            {/* Similarity warnings with Ekle/Yoksay buttons */}
            {similarityWarnings.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-amber-800 font-medium">
                    <AlertTriangle className="w-5 h-5" />
                    Benzer Şirketler ({similarityWarnings.length})
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="text-xs h-7"
                      onClick={() => {
                        const newSkip = new Set(skipItems);
                        similarityWarnings.forEach(w => newSkip.add(w.rowNum));
                        setSkipItems(newSkip);
                        setUpdateItems(new Map());
                      }}
                    >
                      Tümünü Yoksay
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="text-xs h-7"
                      onClick={() => {
                        const newSkip = new Set(skipItems);
                        similarityWarnings.forEach(w => newSkip.delete(w.rowNum));
                        setSkipItems(newSkip);
                        setUpdateItems(new Map());
                      }}
                    >
                      Tümünü Ekle
                    </Button>
                    <Button 
                      size="sm" 
                      variant="default"
                      className="text-xs h-7 bg-primary hover:opacity-90"
                      onClick={() => {
                        const newUpdate = new Map();
                        const newSkip = new Set(skipItems);
                        similarityWarnings.forEach(w => {
                          const targetId = w.similarities[0]?.customer_id;
                          if (targetId) {
                            newUpdate.set(w.rowNum, targetId);
                            newSkip.delete(w.rowNum);
                          }
                        });
                        setUpdateItems(newUpdate);
                        setSkipItems(newSkip);
                      }}
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Tümünü Güncelle
                    </Button>
                  </div>
                </div>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {similarityWarnings.map((warning, i) => (
                    <div key={i} className={`bg-white rounded-lg p-3 border ${
                      warning.similarity_status === "duplicate" 
                        ? "border-red-200" 
                        : "border-amber-100"
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {warning.similarity_status === "duplicate" ? (
                            <Badge className="bg-red-100 text-red-700 text-xs">Kopya</Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-700 text-xs">Benzer</Badge>
                          )}
                          <span className="font-medium text-slate-800">&ldquo;{warning.company_name}&rdquo;</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant={updateItems.has(warning.rowNum) ? "default" : "outline"}
                            className={`text-xs h-7 ${updateItems.has(warning.rowNum) ? "bg-primary hover:opacity-90" : ""}`}
                            onClick={() => {
                              const newUpdate = new Map(updateItems);
                              const newSkip = new Set(skipItems);
                              // Get the first similar customer's ID
                              const targetId = warning.similarities[0]?.customer_id;
                              if (targetId) {
                                newUpdate.set(warning.rowNum, targetId);
                                newSkip.delete(warning.rowNum);
                                setUpdateItems(newUpdate);
                                setSkipItems(newSkip);
                              }
                            }}
                            disabled={!warning.similarities[0]?.customer_id}
                            title="Mevcut müşterinin boş alanlarını doldur"
                          >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Güncelle
                          </Button>
                          <Button
                            size="sm"
                            variant={!skipItems.has(warning.rowNum) && !updateItems.has(warning.rowNum) ? "default" : "outline"}
                            className={`text-xs h-7 ${!skipItems.has(warning.rowNum) && !updateItems.has(warning.rowNum) ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
                            onClick={() => {
                              const newSkip = new Set(skipItems);
                              const newUpdate = new Map(updateItems);
                              newSkip.delete(warning.rowNum);
                              newUpdate.delete(warning.rowNum);
                              setSkipItems(newSkip);
                              setUpdateItems(newUpdate);
                            }}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Ekle
                          </Button>
                          <Button
                            size="sm"
                            variant={skipItems.has(warning.rowNum) ? "destructive" : "outline"}
                            className="text-xs h-7"
                            onClick={() => {
                              const newSkip = new Set(skipItems);
                              const newUpdate = new Map(updateItems);
                              newSkip.add(warning.rowNum);
                              newUpdate.delete(warning.rowNum);
                              setSkipItems(newSkip);
                              setUpdateItems(newUpdate);
                            }}
                          >
                            <X className="w-3 h-3 mr-1" />
                            Yoksay
                          </Button>
                        </div>
                      </div>
                      {warning.similarities.map((sim, j) => (
                        <p key={j} className="text-sm text-slate-600 ml-2">
                          → Mevcut &ldquo;<span className="font-medium">{sim.company_name}</span>&rdquo; ile 
                          <span className={`font-bold ml-1 ${
                            sim.similarity_score >= 95 ? "text-red-600" : 
                            sim.similarity_score >= 80 ? "text-amber-600" : "text-yellow-600"
                          }`}>
                            %{sim.similarity_score}
                          </span> benzerlik ({sim.match_type})
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All items preview - only new ones */}
            {previewData.filter(item => item.similarity_status === "new").length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <p className="font-medium text-slate-700 mb-2">Yeni Şirketler (Benzerlik Yok)</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {previewData
                    .filter(item => item.similarity_status === "new")
                    .slice(0, 10)
                    .map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-slate-600">
                        <CheckCircle className="w-3 h-3 text-emerald-500" />
                        {item.company_name}
                      </div>
                    ))
                  }
                  {previewData.filter(item => item.similarity_status === "new").length > 10 && (
                    <p className="text-xs text-slate-500">
                      ...ve {previewData.filter(item => item.similarity_status === "new").length - 10} daha
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </ScrollArea>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0" data-testid="import-modal">
        <DialogHeader className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            {step !== 'select' && (
              <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <div className="p-2 bg-emerald-100 rounded-lg">
              <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
            </div>
            <DialogTitle className="text-xl font-semibold">
              {step === 'select' && 'Veri İçe Aktarma'}
              {step === 'company' && 'Şirket Verilerini İçe Aktar'}
              {step === 'visit' && 'Ziyaret Verilerini İçe Aktar'}
              {step === 'preview' && `${importType === 'company' ? 'Şirket' : 'Ziyaret'} Verilerini İçe Aktar`}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Veri içe aktarma penceresi
            </DialogDescription>
          </div>
        </DialogHeader>

        {step === 'select' && renderSelectStep()}
        {step === 'company' && renderCompanyStep()}
        {step === 'visit' && renderVisitStep()}
        {step === 'preview' && renderPreviewStep()}

        {/* Footer for preview */}
        {step === 'preview' && (
          <div className="px-6 py-4 border-t border-slate-200 space-y-3">
            {/* Progress Bar - Only show during import */}
            {importing && importProgress.total > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">
                    {importProgress.current === 0 ? 'Hazırlanıyor...' : 
                     importProgress.current === 1 && importType === 'company' ? 'Seçenekler kaydedildi, müşteriler aktarılıyor...' :
                     'İçe aktarılıyor...'}
                  </span>
                  <span className="font-medium text-emerald-600">
                    %{Math.round((importProgress.current / importProgress.total) * 100)}
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-3 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 text-center">
                  %{Math.round((importProgress.current / importProgress.total) * 100)} tamamlandı
                </p>
              </div>
            )}
            
            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack} disabled={importing}>
                Geri
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={importing || checkingSimilarity || previewData.length === skipItems.size}
                className="bg-emerald-600 hover:bg-emerald-700"
                data-testid="btn-confirm-import"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    İçe aktarılıyor... %{importProgress.total > 0 ? Math.round((importProgress.current / importProgress.total) * 100) : 0}
                  </>
                ) : checkingSimilarity ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Kontrol ediliyor...
                  </>
                ) : (
                  `${previewData.length - skipItems.size} ${importType === 'company' ? 'Şirketi' : 'Ziyareti'} İçe Aktar`
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ImportModal;
