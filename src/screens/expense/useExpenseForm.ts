import { useState, useEffect, useCallback, useRef } from 'react';
import { t } from '../../i18n';
import { catKey } from '../../i18nHelpers';
import { api } from "../../api/client";
import { fmtDecInput, toDec2Comma } from "../../utils/numbers";

/* ── helpers ── */
const todayStr = () => {
  const d = new Date();
  const cn = new Date(d.getTime() + 8 * 3600000);
  return cn.toISOString().slice(0, 10);
};
const isFuture = (d: string) => d > todayStr();


interface UseExpenseFormOptions {
  onExpenseHistory?: () => void;
  getPreviewUrl: (file: File) => string;
  revokePreviewUrl: (file: File) => void;
  clearUrlCache: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  expDateInputRef: React.RefObject<HTMLInputElement | null>;
  onToast: (msg: string) => void;
}

export function useExpenseForm(options: UseExpenseFormOptions) {
  const { onExpenseHistory, getPreviewUrl, revokePreviewUrl, clearUrlCache, fileInputRef, expDateInputRef, onToast } = options;

  /* ── expense form state ── */
  const [expDate, setExpDate] = useState(todayStr());
  const [expDateErr, setExpDateErr] = useState(0);
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('daily');
  const [payMethod, setPayMethod] = useState('payWechat');
  const [expNote, setExpNote] = useState('');
  const [expImages, setExpImages] = useState<File[]>([]);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expCatTotals, setExpCatTotals] = useState({ daily: 0, rent: 0, salary: 0, goods: 0 });
  const [loadingExp, setLoadingExp] = useState(false);
  const [showExpConfirm, setShowExpConfirm] = useState(false);

  /* ── image compression ── */
  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve, _reject) => {
      if (file.size < 500 * 1024) return resolve(file);
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 1920;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) {
            height = Math.round((height * MAX) / width);
            width = MAX;
          } else {
            width = Math.round((width * MAX) / height);
            height = MAX;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(file);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) return resolve(file);
            const compressed = new File([blob], file.name, { type: 'image/jpeg' });
            resolve(compressed.size < file.size ? compressed : file);
          },
          'image/jpeg',
          0.8,
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(file);
      };
      img.src = url;
    });
  };

  /* ── image select / remove ── */
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) continue;
      if (f.size > 10 * 1024 * 1024) continue;
      if (expImages.some((ei) => ei.name === f.name && ei.size === f.size)) continue;
      const compressed = await compressImage(f);
      newFiles.push(compressed);
    }
    setExpImages((prev) => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (idx: number) => {
    setExpImages((prev) => {
      if (prev[idx]) revokePreviewUrl(prev[idx]);
      return prev.filter((_, i) => i !== idx);
    });
  };

  /* ── load expenses ── */
  const loadExpenses = useCallback(async () => {
    try {
      const allExpenses: any[] = [];
      let page = 1;
      while (true) {
        const tx: any = await api.getTransactions(page, 100);
        const exps = (tx.transactions || []).filter((t: any) => t.type === 'expense');
        allExpenses.push(...exps);
        if (page >= (tx.pages || 1)) break;
        page++;
      }
      setExpenses(allExpenses);
      let daily = 0,
        rent = 0,
        salary = 0,
        goods = 0;
      allExpenses.forEach((e: any) => {
        const k = catKey(e.category || '');
        const amt = e.amount || 0;
        if (k === 'daily') daily += amt;
        else if (k === 'rent') rent += amt;
        else if (k === 'salary') salary += amt;
        else if (k === 'goods') goods += amt;
      });
      setExpCatTotals({ daily, rent, salary, goods });
    } catch {
      onToast(t('toastLoadFailed'));
    }
  }, []);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  /* ── handle date change (for native input onChange) ── */
  const handleExpDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isFuture(e.target.value)) {
        if (expDateInputRef.current) expDateInputRef.current.value = expDate;
        setExpDateErr((c) => c + 1);
      } else {
        setExpDate(e.target.value);
      }
    },
    [expDate, expDateInputRef],
  );

  /* ── submit ── */
  const handleAddExpense = useCallback(async () => {
    if (!expAmount || parseFloat(expAmount.replace(/,/g, '')) <= 0) return;
    if (isFuture(expDate)) {
      return;
    }
    setLoadingExp(true);
    try {
      let imageUrls: string[] = [];
      let thumbUrls: string[] = [];
      if (expImages.length > 0) {
        setUploadingImg(true);
        const result = await api.uploadExpenseImages(expImages);
        setUploadingImg(false);
        if (result.status !== 'ok') {
          setLoadingExp(false);
          return;
        }
        imageUrls = result.images || [];
        thumbUrls =
          result.thumb_images && result.thumb_images.length > 0 ? result.thumb_images : imageUrls;
      }
      await api.createTransaction({
        type: 'expense',
        amount: parseFloat(expAmount.replace(/,/g, '')),
        category: expCategory,
        account: payMethod,
        note: expNote,
        date: expDate,
        images: imageUrls,
        thumb_images: thumbUrls,
      });
      clearUrlCache();
      setExpAmount('');
      setExpCategory('daily');
      setPayMethod('payWechat');
      setExpNote('');
      setExpDate(todayStr());
      setExpImages([]);
      await loadExpenses();
      onExpenseHistory?.();
    } catch {
      onToast(t('toastSubmitFailed'));
    }
    setLoadingExp(false);
  }, [
    expAmount,
    expDate,
    expImages,
    expCategory,
    payMethod,
    expNote,
    clearUrlCache,
    loadExpenses,
    onExpenseHistory,
  ]);

  /* ── reset form ── */
  const resetForm = useCallback(() => {
    setExpAmount('');
    setExpCategory('daily');
    setPayMethod('payWechat');
    setExpNote('');
    setExpDate(todayStr());
    setExpImages([]);
    setExpDateErr(0);
    setShowExpConfirm(false);
    setLoadingExp(false);
    setUploadingImg(false);
  }, []);

  // Derived: true when the form should be disabled (no amount, zero, or loading)
  const isAmountInvalid =
    !expAmount || parseFloat(expAmount.replace(/,/g, '')) <= 0 || loadingExp;

  return {
    // state
    expDate,
    setExpDate,
    expDateErr,
    setExpDateErr,
    expAmount,
    setExpAmount,
    expCategory,
    setExpCategory,
    payMethod,
    setPayMethod,
    expNote,
    setExpNote,
    expImages,
    setExpImages,
    uploadingImg,
    expenses,
    expCatTotals,
    loadingExp,
    showExpConfirm,
    setShowExpConfirm,
    // actions
    loadExpenses,
    handleAddExpense,
    handleImageSelect,
    removeImage,
    handleExpDateChange,
    resetForm,
    // derived
    isAmountInvalid,
    // formatters (re-exported for convenience)
    fmtDecInput,
    toDec2Comma,
    todayStr,
  };
}
