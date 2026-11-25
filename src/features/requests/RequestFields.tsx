import { View } from 'react-native';
import { ChoiceGroup, Field } from '../../components/ui';
import { CATEGORY_LABEL, URGENCY_HINT, URGENCY_LABEL } from '../../domain/labels';
import { CATEGORIES, URGENCIES, type Category, type Urgency } from '../../domain/types';
import { DESCRIPTION_MAX, type RequestFormErrors } from '../../domain/validation';
import { space } from '../../theme';

export function RequestFields({
  category,
  urgency,
  description,
  errors,
  onChange,
  editable = true,
}: {
  category: Category | null;
  urgency: Urgency | null;
  description: string;
  errors: RequestFormErrors;
  onChange: (patch: { category?: Category; urgency?: Urgency; description?: string }) => void;
  editable?: boolean;
}) {
  return (
    <View style={{ gap: space.lg }} pointerEvents={editable ? 'auto' : 'none'}>
      <ChoiceGroup
        label="What kind of problem is it?"
        options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))}
        value={category}
        onChange={(v) => onChange({ category: v })}
        error={errors.category}
      />
      <ChoiceGroup
        label="How urgent is it?"
        options={URGENCIES.map((u) => ({ value: u, label: URGENCY_LABEL[u] }))}
        value={urgency}
        onChange={(v) => onChange({ urgency: v })}
        error={errors.urgency}
        hint={urgency ? URGENCY_HINT[urgency] : 'If anyone is in danger, call emergency services first.'}
      />
      <Field
        label="What’s going on?"
        value={description}
        onChangeText={(t) => onChange({ description: t })}
        multiline
        placeholder="Where is it, when did it start, and what have you tried?"
        error={errors.description}
        counter={`${description.length}/${DESCRIPTION_MAX}`}
        maxLength={DESCRIPTION_MAX + 50}
      />
    </View>
  );
}
