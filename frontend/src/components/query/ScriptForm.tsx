import React, { useRef, useState } from 'react';
import { Upload, X, FileText } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface ScriptFormProps {
    comments: string;
    selectedFile: File | null;
    onCommentsChange: (value: string) => void;
    onFileSelect: (file: File | null) => void;
}

export const ScriptForm: React.FC<ScriptFormProps> = ({
    comments,
    selectedFile,
    onCommentsChange,
    onFileSelect,
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [dragOver, setDragOver] = useState(false);

    const validateAndSelectFile = (file: File) => {
        const validExtensions = ['.js', '.py'];
        const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

        if (!validExtensions.includes(extension)) {
            toast.error('Please upload a .js or .py file');
            return;
        }

        if (file.size > 16 * 1024 * 1024) {
            toast.error('File size must be less than 16MB');
            return;
        }

        onFileSelect(file);
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            validateAndSelectFile(e.target.files[0]);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files?.[0]) {
            validateAndSelectFile(e.dataTransfer.files[0]);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(true);
    };

    const handleDragLeave = () => {
        setDragOver(false);
    };

    const handleRemoveFile = () => {
        onFileSelect(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="space-y-6">
            {/* Comments */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Comments <span className="text-red-500">*</span>
                </label>
                <textarea
                    value={comments}
                    onChange={(e) => onCommentsChange(e.target.value)}
                    placeholder="Describe what this script does..."
                    rows={3}
                    className="textarea-field"
                    required
                />
            </div>

            {/* File Upload */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Script File <span className="text-red-500">*</span>
                </label>

                {selectedFile ? (
                    <div className="flex items-center justify-between p-4 bg-purple-50 border border-purple-200 rounded-lg">
                        <div className="flex items-center gap-3">
                            <FileText className="w-8 h-8 text-purple-600" />
                            <div>
                                <p className="font-medium text-gray-900">{selectedFile.name}</p>
                                <p className="text-sm text-gray-500">
                                    {(selectedFile.size / 1024).toFixed(2)} KB
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleRemoveFile}
                            className="p-1 hover:bg-purple-100 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>
                ) : (
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        className={`upload-zone ${dragOver ? 'dragover' : ''}`}
                    >
                        <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600 font-medium">Click to upload or drag and drop</p>
                        <p className="text-sm text-gray-500 mt-1">
                            JavaScript (.js) files only (max 16MB)
                        </p>
                    </div>
                )}

                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".js"
                    onChange={handleFileInput}
                    className="hidden"
                />
            </div>
        </div>
    );
};
