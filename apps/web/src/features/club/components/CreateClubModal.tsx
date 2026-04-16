import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Upload, Image as ImageIcon } from 'lucide-react';

interface CreateClubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateClub: (clubData: { name: string; logoUrl: string; description: string }) => void;
  existingClubNames: string[];
}

export const CreateClubModal = ({
  isOpen,
  onClose,
  onCreateClub,
  existingClubNames,
}: CreateClubModalProps) => {
  const [clubName, setClubName] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState('');
  const [imageError, setImageError] = useState('');

  const validateClubName = (name: string) => {
    if (!name.trim()) {
      setNameError('Club name is required');
      return false;
    }
    if (name.length < 3) {
      setNameError('Must be at least 3 characters');
      return false;
    }
    if (name.length > 30) {
      setNameError('Must be less than 30 characters');
      return false;
    }
    if (existingClubNames.some(n => n.toLowerCase() === name.trim().toLowerCase())) {
      setNameError('This club name is already taken');
      return false;
    }
    setNameError('');
    return true;
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setClubName(val);
    if (val.trim()) validateClubName(val);
    else setNameError('');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setImageError('Please upload an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageError('Image must be less than 5MB');
      return;
    }
    setImageError('');
    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCreate = () => {
    if (!validateClubName(clubName)) return;
    onCreateClub({ name: clubName.trim(), logoUrl: logoPreview ?? '', description: description.trim() });
    // Reset
    setClubName('');
    setLogoPreview(null);
    setLogoFile(null);
    setDescription('');
    setNameError('');
    setImageError('');
  };

  const isValid = clubName.trim().length > 0 && !nameError;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[80]"
            onClick={onClose}
          />

          {/* Bottom sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[90] bg-white rounded-t-3xl max-h-[92vh] flex flex-col
                       shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2 shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            {/* Header */}
            <div className="px-6 pb-4 flex items-center justify-between shrink-0 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Create Club</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-sm"
              >
                ✕
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5 space-y-5">
              {/* Club Logo */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-3">
                  Club Logo
                </label>
                <div className="flex items-center gap-4">
                  <div className={`w-20 h-20 rounded-2xl flex items-center justify-center overflow-hidden shrink-0 ${
                    logoPreview ? 'bg-gray-100' : 'bg-gray-50 border-2 border-dashed border-gray-200'
                  }`}>
                    {logoPreview
                      ? <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
                      : <ImageIcon className="w-8 h-8 text-gray-300" strokeWidth={1.5} />
                    }
                  </div>
                  <div className="flex-1">
                    <label className="block cursor-pointer">
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 flex items-center gap-3 active:bg-gray-100 transition">
                        <Upload className="w-5 h-5 text-[#D93518]" strokeWidth={2} />
                        <div>
                          <div className="text-sm font-medium text-gray-700">
                            {logoFile ? logoFile.name : 'Upload Logo'}
                          </div>
                          <div className="text-xs text-gray-400">Max 5MB · JPG or PNG</div>
                        </div>
                      </div>
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>
                    {imageError && <p className="text-xs text-red-500 mt-1.5">{imageError}</p>}
                  </div>
                </div>
              </div>

              {/* Club Name */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-3">
                  Club Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={clubName}
                  onChange={handleNameChange}
                  placeholder="Enter a unique club name..."
                  maxLength={30}
                  className={`w-full border rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400
                             focus:outline-none transition-colors ${
                               nameError
                                 ? 'border-red-400 bg-red-50 focus:border-red-400'
                                 : 'border-gray-200 bg-white focus:border-[#D93518]'
                             }`}
                />
                <div className="flex items-center justify-between mt-1.5">
                  {nameError ? (
                    <span className="text-xs text-red-500">{nameError}</span>
                  ) : (
                    <span className="text-xs text-gray-400">{clubName.length}/30</span>
                  )}
                  {clubName.trim() && !nameError && (
                    <div className="flex items-center gap-1 text-xs text-[#D93518] font-medium">
                      <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                      Available
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-3">
                  Description <span className="text-gray-300 font-normal normal-case">(optional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Tell others about your club..."
                  maxLength={100}
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900
                             placeholder:text-gray-400 focus:outline-none focus:border-[#D93518] resize-none"
                />
                <span className="text-xs text-gray-400">{description.length}/100</span>
              </div>
            </div>

            {/* Footer CTA */}
            <div
              className="px-6 pt-4 pb-6 shrink-0 border-t border-gray-100 space-y-2"
              style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
            >
              <button
                onClick={handleCreate}
                disabled={!isValid}
                className={`w-full py-4 rounded-2xl text-sm font-bold transition-all ${
                  isValid
                    ? 'bg-gradient-to-r from-[#D93518] to-[#B82D14] text-white shadow-[0_4px_16px_rgba(217,53,24,0.25)] active:scale-[0.98]'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                Create Club
              </button>
              <button
                onClick={onClose}
                className="w-full py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-medium text-gray-500"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
