'use client';

import { useState, useRef } from 'react';

interface AnalyzeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AnalyzeModal({ isOpen, onClose }: AnalyzeModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    linkedin: '',
    objective: '',
    networkSize: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const objectives = [
    'Gerar leads para nova oferta',
    'Encontrar parceiros ou especialistas',
    'Mobilizar rede para projeto específico',
    'Expandir para novo mercado',
    'Validar demanda para produto/serviço',
    'Levantar recursos ou investimento',
    'Outro',
  ];

  const networkSizes = [
    'Até 500',
    '500 - 3.000',
    '3.000 - 5.000',
    '5.000 - 10.000',
    'Mais de 10.000',
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const payload = {
        ...formData,
        networkSize: formData.networkSize || 'Não informado',
        timestamp: new Date().toLocaleString('pt-BR'),
      };

      const response = await fetch('https://formsubmit.co/ajax/farleyrl12@hotmail.com', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: '✓ Dados enviados com sucesso! A gente retorna em breve.' });
        setFormData({ name: '', email: '', phone: '', linkedin: '', objective: '', networkSize: '' });

        setTimeout(() => {
          onClose();
          setMessage(null);
        }, 2000);
      } else {
        throw new Error('Erro ao enviar');
      }
    } catch (error) {
      setMessage({ type: 'error', text: '✗ Erro ao enviar. Tente novamente ou entre em contato direto.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-12 shadow-xl">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 flex h-8 w-8 items-center justify-center text-neutral-600 hover:text-neutral-900 text-2xl"
          >
            ×
          </button>

          {/* Header */}
          <div className="mb-8">
            <h2 className="mb-2 text-2xl font-black text-neutral-900">Analisar minha rede</h2>
            <p className="text-neutral-600">
              Preencha os dados abaixo e a gente te retorna com um plano de ação.
            </p>
          </div>

          {/* Message */}
          {message && (
            <div
              className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${
                message.type === 'success'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Form */}
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
            {/* Name */}
            <div>
              <label className="block text-sm font-semibold text-neutral-900 mb-2">
                Nome <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Seu nome completo"
                required
                className="w-full rounded-lg border border-neutral-200 px-4 py-3 text-neutral-900 placeholder-neutral-400 transition-colors focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-opacity-10"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-neutral-900 mb-2">
                E-mail <span className="text-red-600">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="seu@email.com"
                required
                className="w-full rounded-lg border border-neutral-200 px-4 py-3 text-neutral-900 placeholder-neutral-400 transition-colors focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-opacity-10"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-semibold text-neutral-900 mb-2">
                Telefone <span className="text-red-600">*</span>
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="(11) 99999-9999"
                required
                className="w-full rounded-lg border border-neutral-200 px-4 py-3 text-neutral-900 placeholder-neutral-400 transition-colors focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-opacity-10"
              />
            </div>

            {/* LinkedIn */}
            <div>
              <label className="block text-sm font-semibold text-neutral-900 mb-2">
                LinkedIn <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                name="linkedin"
                value={formData.linkedin}
                onChange={handleChange}
                placeholder="linkedin.com/in/seu-username"
                required
                className="w-full rounded-lg border border-neutral-200 px-4 py-3 text-neutral-900 placeholder-neutral-400 transition-colors focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-opacity-10"
              />
            </div>

            {/* Objective */}
            <div>
              <label className="block text-sm font-semibold text-neutral-900 mb-2">
                Qual é seu objetivo? <span className="text-red-600">*</span>
              </label>
              <select
                name="objective"
                value={formData.objective}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-neutral-200 px-4 py-3 text-neutral-900 transition-colors focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-opacity-10"
              >
                <option value="">Selecione uma opção</option>
                {objectives.map(obj => (
                  <option key={obj} value={obj}>
                    {obj}
                  </option>
                ))}
              </select>
            </div>

            {/* Network Size */}
            <div>
              <label className="block text-sm font-semibold text-neutral-900 mb-2">
                Tamanho aproximado da sua rede
              </label>
              <select
                name="networkSize"
                value={formData.networkSize}
                onChange={handleChange}
                className="w-full rounded-lg border border-neutral-200 px-4 py-3 text-neutral-900 transition-colors focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-opacity-10"
              >
                <option value="">Selecione (opcional)</option>
                {networkSizes.map(size => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 font-semibold text-neutral-900 transition-colors hover:bg-neutral-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 rounded-lg bg-neutral-900 px-4 py-3 font-semibold text-white transition-all hover:bg-neutral-800 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Enviando...' : 'Analisar minha rede'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
