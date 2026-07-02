import { useState } from 'react';
import { t } from '../../i18n';
import { api } from '../../api/client';
import { validateEmail } from '../../utils/validation';

export function useProfileForms(setToast: (msg: string) => void) {
  // ── Change Password ──
  const [showPwModal, setShowPwModal] = useState(false);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  // ── Change Email (two-step) ──
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailStep, setEmailStep] = useState<'input' | 'code'>('input');
  const [newEmail, setNewEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [modalMsg, setModalMsg] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  const openEmailModal = () => {
    setShowEmailModal(true);
    setNewEmail(''); setEmailCode(''); setEmailStep('input'); setModalMsg('');
  };

  const handleChangePw = async () => {
    setModalMsg('');
    if (!oldPw) { setModalMsg(t('errOldPwRequired')); return; }
    if (!newPw) { setModalMsg('请输入新密码'); return; }
    if (newPw !== confirmPw) { setModalMsg(t('errPwMismatch')); return; }
    setModalLoading(true);
    try {
      const r: any = await api.changePassword(oldPw, newPw);
      if (r.status === 'ok') {
        setShowPwModal(false);
        setOldPw(''); setNewPw(''); setConfirmPw('');
        setToast('密码修改成功');
      } else {
        setModalMsg(r.message || '修改失败');
      }
    } catch (e: any) { setModalMsg(e.message || t('errNetworkError')); }
    setModalLoading(false);
  };

  const handleSendCode = async () => {
    setModalMsg('');
    if (!newEmail) { setModalMsg('请输入新邮箱'); return; }
    if (validateEmail(newEmail)) { setModalMsg(t('errEmailInvalid')); return; }
    setModalLoading(true);
    try {
      const r: any = await api.sendEmailCode(newEmail);
      if (r.status === 'ok') {
        setEmailStep('code');
      } else {
        setModalMsg(r.message || '发送失败');
      }
    } catch (e: any) { setModalMsg(e.message || t('errNetworkError')); }
    setModalLoading(false);
  };

  const handleVerifyEmail = async (onSuccess: (email: string) => void) => {
    setModalMsg('');
    if (!emailCode) { setModalMsg('请输入验证码'); return; }
    setModalLoading(true);
    try {
      const r: any = await api.verifyEmailCode(newEmail, emailCode);
      if (r.status === 'ok') {
        onSuccess(newEmail);
        setNewEmail(''); setEmailCode(''); setEmailStep('input');
        setShowEmailModal(false);
      } else {
        setModalMsg(r.message || '验证失败');
      }
    } catch (e: any) { setModalMsg(e.message || t('errNetworkError')); }
    setModalLoading(false);
  };

  return {
    showPwModal, setShowPwModal,
    showEmailModal, setShowEmailModal,
    emailStep, setEmailStep,
    oldPw, setOldPw, newPw, setNewPw, confirmPw, setConfirmPw,
    newEmail, setNewEmail, emailCode, setEmailCode,
    modalMsg, setModalMsg, modalLoading,
    handleChangePw, handleSendCode, handleVerifyEmail, openEmailModal,
  };
}
