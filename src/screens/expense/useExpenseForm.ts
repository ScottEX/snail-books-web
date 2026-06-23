import { useState, useEffect, useCallback } from 'react';
import { t } from '../../i18n';
import { api } from "../../api/client";
import { fmtDecInput, toDec2Comma } from "../../utils/numbers";
import { useServerDate } from '../../hooks/useServerDate';

// Date helpers replaced by useServerDate() hook (server time, not client)


interface UseExpenseFormOptions {
  onExpenseHistory?: () => void;
  getPreviewUrl: (file: File) => string;
  revokePreviewUrl: (file: File) => void;
  clearUrlCache: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  expDateInputRef: React.RefObject<HTMLInputElement | null>;
  onToast: (msg: string) => void;
  onExpenseAdded?: () => void;
}

export function useExpenseForm(options: UseExpenseFormOptions) {
  const { onExpenseHistory, getPreviewUrl, revokePreviewUrl, clearUrlCache, fileInputRef, expDateInputRef, onToast, onExpenseAdded } = options;
  const sd = useServerDate();

  /* ── expense form state ── */
  const [expDate, setExpDate] = useState('');
  useEffect(() => { if (sd.ready && expDate === '') setExpDate(sd.today); }, [sd.ready, sd.today, expDate]);
  const [expDateErr, setExpDateErr] = useState(0);
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('daily');
  const [payMethod, setPayMethod] = useState('payWechat');
  const [expNote, setExpNote] = useState('');
  const [expImages, setExpImages] = useState<File[]>([]);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [loadingExp, setLoadingExp] = useState(false);
  const [showExpConfirm, setShowExpConfirm] = useState(false);
  const [isRefund, setIsRefund] = useState(false);

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

  /* ── handle date change (for native input onChange) ── */
  const handleExpDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (sd.isFuture(e.target.value)) {
        if (expDateInputRef.current) expDateInputRef.current.value = expDate;
        setExpDateErr((c) => c + 1);
      } else {
        setExpDate(e.target.value);
      }
    },
    [expDate, expDateInputRef],
  );

  /* ── submit ── */
  // Format input for refund mode — UI already renders a leading sign
  const fmtRefundInput = useCallback((v: string) => {
    if (!isRefund) return fmtDecInput(v);
    // UI already renders a leading sign — strip any leading '-' from input
    const stripped = v.startsWith('-') ? v.slice(1) : v;
    return fmtDecInput(stripped);
  }, [isRefund]);

  const handleAddExpense = useCallback(async () => {
    const raw = parseFloat(expAmount.replace(/,/g, ''));
    if (!expAmount || raw === 0) return;
    if (!isRefund && raw <= 0) return;
    if (sd.isFuture(expDate)) {
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
          setUploadingImg(false);
          onToast(t('uploadFailed'));
          return;
        }
        imageUrls = result.images || [];
        thumbUrls =
          result.thumb_images && result.thumb_images.length > 0 ? result.thumb_images : imageUrls;
      }
      await api.createTransaction({
        type: 'expense',
        amount: parseFloat(expAmount.replace(/,/g, '')) * (isRefund ? -1 : 1),
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
      setExpDate(sd.today);
      setExpImages([]);
      setIsRefund(false);
      onExpenseHistory?.();
      onExpenseAdded?.();
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
    isRefund,
    clearUrlCache,
    onExpenseHistory,
    onExpenseAdded,
  ]);

  /* ── reset form ── */
  const resetForm = useCallback(() => {
    setExpAmount('');
    setExpCategory('daily');
    setPayMethod('payWechat');
    setExpNote('');
    setExpDate(sd.today);
    setExpImages([]);
    setExpDateErr(0);
    setShowExpConfirm(false);
    setLoadingExp(false);
    setUploadingImg(false);
    setIsRefund(false);
  }, []);

  // Derived: true when the form should be disabled (no amount, zero, or loading)
  const isAmountInvalid =
    !expAmount || parseFloat(expAmount.replace(/,/g, '')) === 0 || loadingExp;

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
    loadingExp,
    showExpConfirm,
    setShowExpConfirm,
    isRefund,
    setIsRefund,
    // actions
    handleAddExpense,
    handleImageSelect,
    removeImage,
    handleExpDateChange,
    resetForm,
    // derived
    isAmountInvalid,
    // formatters (re-exported for convenience)
    fmtDecInput,
    fmtRefundInput,
    toDec2Comma,
  };
}
