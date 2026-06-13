import { useState } from 'react';
import { api } from '../../api/client';

export function useSignatureForm() {
  const [signature, setSignature] = useState('');
  const [signatureEditing, setSignatureEditing] = useState(false);
  const [signatureDraft, setSignatureDraft] = useState('');

  const handleSignatureSave = async () => {
    setSignatureEditing(false);
    const val = signatureDraft.trim();
    if (val === signature) return;
    setSignature(val);
    try { await api.saveSignature(val); } catch {}
  };

  const startEditing = () => {
    setSignatureDraft(signature);
    setSignatureEditing(true);
  };

  return {
    signature, setSignature,
    signatureEditing, setSignatureEditing,
    signatureDraft, setSignatureDraft,
    handleSignatureSave,
    startEditing,
  };
}
