import { useState, useCallback } from 'react';
import { generateTagsFromText } from '../../api/businessCardApi';
import TagInput from '../TagInput/TagInput';

interface CardEditorProps {
  cardId: string;
  ownerId: string;
  formData: {
    search_tags?: string[];
    [key: string]: unknown;
  };
  handleFieldChange: (field: string, value: unknown) => void;
}

const CardEditor: React.FC<CardEditorProps> = ({ cardId, ownerId, formData, handleFieldChange }) => {
  const [isGeneratingTags, setIsGeneratingTags] = useState(false);

  const handleGenerateTagsFromText = useCallback(
    async (text: string): Promise<string[]> => {
      if (!cardId || !ownerId) {
        console.error('Card ID or Owner ID is missing');
        return [];
      }

      setIsGeneratingTags(true);
      try {
        const response = await generateTagsFromText(cardId, ownerId, text);
        return response.suggestions;
      } catch (error) {
        console.error('Failed to generate tags from text:', error);
        throw error; // Пробрасываем для отображения ошибки в TagInput
      } finally {
        setIsGeneratingTags(false);
      }
    },
    [cardId, ownerId]
  );

  return (
    <div>
      {/* ...existing code... */}
      <TagInput
        tags={formData.search_tags || []}
        onTagsChange={(newTags: string[]) => handleFieldChange('search_tags', newTags)}
        placeholder="Добавить тег для поиска..."
        maxTags={20}
        enableTextGeneration={true}
        onGenerateFromText={handleGenerateTagsFromText}
        isGenerating={isGeneratingTags}
      />
      {/* ...existing code... */}
    </div>
  );
};

export default CardEditor;