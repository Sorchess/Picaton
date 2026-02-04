import { useState, useCallback } from "react";
import { IconButton, Modal, Button } from "@/shared";
import { projectApi, type CreateProjectRequest } from "@/entities/project";
import "./CreateProjectModal.scss";

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (projectId: string) => void;
}

// Back arrow icon
const BackArrowIcon = () => (
  <svg width="10" height="18" viewBox="0 0 10 18" fill="none">
    <path
      d="M9 1L1 9L9 17"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Code icon for skills
const CodeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path
      d="M16 18L22 12L16 6M8 6L2 12L8 18"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Calendar icon
const CalendarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <rect
      x="3"
      y="4"
      width="18"
      height="18"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="M16 2V6M8 2V6M3 10H21"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

// User add icon
const UserAddIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
    <path
      d="M3 21V19C3 16.7909 4.79086 15 7 15H11C13.2091 15 15 16.7909 15 19V21"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M19 8V14M16 11H22"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

// Target icon
const TargetIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="12" r="2" fill="currentColor" />
  </svg>
);

// Microphone icon
const MicIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <rect
      x="9"
      y="2"
      width="6"
      height="11"
      rx="3"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="M5 10V11C5 14.866 8.13401 18 12 18C15.866 18 19 14.866 19 11V10"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M12 18V22M8 22H16"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

// AI sparkle icon
const AIIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path
      d="M12 2L13.09 8.26L18 6L15.74 10.91L22 12L15.74 13.09L18 18L13.09 15.74L12 22L10.91 15.74L6 18L8.26 13.09L2 12L8.26 10.91L6 6L10.91 8.26L12 2Z"
      fill="currentColor"
    />
  </svg>
);

export function CreateProjectModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateProjectModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [deadline, setDeadline] = useState("");
  const [problem, setProblem] = useState("");
  const [solution, setSolution] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setName("");
    setDescription("");
    setTags([]);
    setSkills([]);
    setDeadline("");
    setProblem("");
    setSolution("");
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Укажите название проекта");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const projectData: CreateProjectRequest = {
        name: name.trim(),
        description: description.trim() || undefined,
        is_public: true,
        allow_join_requests: true,
        tags: tags.length > 0 ? tags : undefined,
        required_skills: skills.length > 0 ? skills : undefined,
        deadline: deadline || undefined,
        problem: problem.trim() || undefined,
        solution: solution.trim() || undefined,
      };

      const project = await projectApi.create(projectData);
      resetForm();
      onSuccess?.(project.id);
      onClose();
    } catch (err) {
      console.error("Failed to create project:", err);
      setError("Не удалось создать проект. Попробуйте еще раз.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      className="create-project-modal-wrapper"
    >
      <div className="create-project-modal">
        {/* Header */}
        <div className="create-project-modal__header">
          <IconButton onClick={handleClose} aria-label="Назад">
            <BackArrowIcon />
          </IconButton>
          <Button
            className="create-project-modal__done-btn"
            variant="liquid"
            onClick={handleSubmit}
            disabled={isSubmitting || !name.trim()}
          >
            {isSubmitting ? "..." : "Готово"}
          </Button>
        </div>

        {/* Content */}
        <div className="create-project-modal__content">
          {error && (
            <div
              className="create-project-modal__error"
              onClick={() => setError(null)}
            >
              {error}
            </div>
          )}

          {/* Project Name */}
          <div className="create-project-modal__field create-project-modal__field--card">
            <input
              type="text"
              className="create-project-modal__input create-project-modal__textarea"
              placeholder="Название проекта"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </div>

          {/* Description */}
          <div className="create-project-modal__field create-project-modal__field--card">
            <label className="create-project-modal__label">Описание</label>
            <textarea
              className="create-project-modal__textarea"
              placeholder="Опишите ваш проект"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* Tags */}
          <div className="create-project-modal__field create-project-modal__field--card">
            <label className="create-project-modal__label">Теги</label>
            <div className="create-project-modal__tags">
              {tags.map((tag) => (
                <span key={tag} className="create-project-modal__tag">
                  {tag}
                  <button
                    type="button"
                    onClick={() => setTags(tags.filter((t) => t !== tag))}
                    className="create-project-modal__tag-remove"
                  >
                    ×
                  </button>
                </span>
              ))}
              <button
                type="button"
                className="create-project-modal__tag-add"
                onClick={() => {
                  const newTag = prompt("Введите тег:");
                  if (newTag?.trim() && !tags.includes(newTag.trim())) {
                    setTags([...tags, newTag.trim()]);
                  }
                }}
              >
                +
              </button>
            </div>
          </div>

          {/* Skills */}
          <div className="create-project-modal__field create-project-modal__field--card">
            <label className="create-project-modal__label">Навыки</label>
            <div className="create-project-modal__skills">
              {skills.map((skill) => (
                <span key={skill} className="create-project-modal__skill">
                  <CodeIcon />
                  {skill}
                  <button
                    type="button"
                    onClick={() => setSkills(skills.filter((s) => s !== skill))}
                    className="create-project-modal__skill-remove"
                  >
                    ×
                  </button>
                </span>
              ))}
              <button
                type="button"
                className="create-project-modal__skill-add"
                onClick={() => {
                  const newSkill = prompt("Введите навык:");
                  if (newSkill?.trim() && !skills.includes(newSkill.trim())) {
                    setSkills([...skills, newSkill.trim()]);
                  }
                }}
              >
                +
              </button>
            </div>
          </div>

          {/* Deadline */}
          <div className="create-project-modal__field create-project-modal__field--card create-project-modal__field--row">
            <div className="create-project-modal__field-content">
              <label className="create-project-modal__label">Дедлайн</label>
              <span className="create-project-modal__value">
                {deadline ? formatDate(deadline) : "Не указан"}
              </span>
            </div>
            <input
              type="date"
              className="create-project-modal__date-input"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
            <CalendarIcon />
          </div>

          {/* Team Section */}
          <div className="create-project-modal__field create-project-modal__field--card">
            <label className="create-project-modal__label">Команда</label>
            <div className="create-project-modal__team-actions">
              <button className="create-project-modal__team-btn create-project-modal__team-btn--invite">
                <UserAddIcon />
                Пригласить
              </button>
              <button className="create-project-modal__team-btn create-project-modal__team-btn--candidates">
                <TargetIcon />
                Кандидаты
              </button>
            </div>
          </div>

          {/* Problem */}
          <div className="create-project-modal__field create-project-modal__field--card">
            <label className="create-project-modal__label">Проблематика</label>
            <textarea
              className="create-project-modal__textarea"
              placeholder="Интересный факт или описание вашего опыта"
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              rows={2}
            />
          </div>

          {/* Solution */}
          <div className="create-project-modal__field create-project-modal__field--card">
            <label className="create-project-modal__label">
              Предлагаемое решение
            </label>
            <textarea
              className="create-project-modal__textarea"
              placeholder="Опишите ваше решение"
              value={solution}
              onChange={(e) => setSolution(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        {/* Footer with AI and Voice */}
        <div className="create-project-modal__footer">
          <button className="create-project-modal__ai-btn">
            <AIIcon />
            Заполнить с AI
          </button>
          <button className="create-project-modal__voice-btn">
            <MicIcon />
          </button>
        </div>
      </div>
    </Modal>
  );
}
