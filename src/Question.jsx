import { Plus, Trash2, ArrowUp, ArrowDown, MessageSquare } from "lucide-react";
import { TYPES } from "./api";
import { Button } from "./ui";
export default function Question({
  question: q,
  index,
  editable,
  selected,
  onSelect,
  onChange,
  onRemove,
  onMove,
  setTarget,
  comments,
}) {
  function target(id, quote) {
    setTarget({ id, quote });
  }
  function selectText(id, text) {
    const selection = window.getSelection()?.toString().trim();
    target(id, selection && text.includes(selection) ? selection : text);
  }
  function changeOption(id, text) {
    onChange({
      ...q,
      options: q.options.map((o) => (o.id === id ? { ...o, text } : o)),
    });
  }
  return (
    <article
      id={"target-" + q.id}
      className={`question ${selected ? "selected" : ""}`}
      onClick={() => onSelect(q.id)}
    >
      <header className="question-header">
        <span className="question-number">{index + 1}</span>
        {editable ? (
          <input
            aria-label={`问题 ${index + 1} 标题`}
            className="question-title"
            value={q.title}
            onFocus={() => target(q.id, q.title)}
            onChange={(e) => onChange({ ...q, title: e.target.value })}
          />
        ) : (
          <h3 onMouseUp={() => selectText(q.id, q.title)}>
            {q.title}
            {q.required && <span className="required">*</span>}
          </h3>
        )}
        {!editable && <small className="type-tag">{TYPES[q.type]}</small>}
        <button
          title="批注这个问题"
          aria-label={`批注问题 ${index + 1}`}
          className="icon-button"
          onClick={() => target(q.id, q.title)}
        >
          <MessageSquare size={17} />
          {comments.filter(
            (c) => !c.parent_id && c.target_id === q.id && !c.resolved,
          ).length || ""}
        </button>
      </header>
      {editable && (
        <div className="question-settings">
          <select
            aria-label={`问题 ${index + 1} 题型`}
            value={q.type}
            onChange={(e) =>
              onChange({
                ...q,
                type: e.target.value,
                options:
                  !["single", "multiple"].includes(e.target.value)
                    ? []
                    : q.options.length < 2
                      ? ["选项一", "选项二"].map((text) => ({
                        id: crypto.randomUUID(),
                        text,
                      }))
                      : q.options,
              })
            }
          >
            {Object.entries(TYPES).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={q.required}
              onChange={(e) => onChange({ ...q, required: e.target.checked })}
            />
            必填
          </label>
          <span className="grow" />
          <button
            aria-label={`上移问题 ${index + 1}`}
            className="icon-button"
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            <ArrowUp size={15} />
          </button>
          <button
            aria-label={`下移问题 ${index + 1}`}
            className="icon-button"
            onClick={() => onMove(1)}
          >
            <ArrowDown size={15} />
          </button>
          <button
            aria-label={`删除问题 ${index + 1}`}
            className="icon-button danger"
            onClick={onRemove}
          >
            <Trash2 size={15} />
          </button>
        </div>
      )}
      {["single", "multiple"].includes(q.type) ? (
        <div className="options">
          {q.options.map((o, i) => (
            <div id={"target-" + o.id} className="option" key={o.id}>
              {editable ? (
                <>
                  <span
                    className={`option-marker ${q.type === "multiple" ? "square" : ""}`}
                  />
                  <input
                    aria-label={`问题 ${index + 1} 选项 ${i + 1}`}
                    value={o.text}
                    onFocus={() => target(o.id, o.text)}
                    onChange={(e) => changeOption(o.id, e.target.value)}
                  />
                  <button
                    aria-label={`批注选项 ${i + 1}`}
                    title="批注选项"
                    className="icon-button"
                    onClick={() => target(o.id, o.text)}
                  >
                    <MessageSquare size={14} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`删除选项 ${i + 1}`}
                    disabled={q.options.length <= 2}
                    onClick={() =>
                      onChange({
                        ...q,
                        options: q.options.filter((x) => x.id !== o.id),
                      })
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              ) : (
                <>
                  <input
                    aria-label={o.text}
                    type={q.type === "single" ? "radio" : "checkbox"}
                    name={q.id}
                  />
                  <span onMouseUp={() => selectText(o.id, o.text)}>
                    {o.text}
                  </span>
                  <button
                    aria-label={`批注选项 ${i + 1}`}
                    className="icon-button"
                    onClick={() => target(o.id, o.text)}
                  >
                    <MessageSquare size={14} />
                  </button>
                </>
              )}
            </div>
          ))}
          {editable && (
            <Button
              variant="text-button"
              icon={Plus}
              onClick={() =>
                onChange({
                  ...q,
                  options: [
                    ...q.options,
                    { id: crypto.randomUUID(), text: "新选项" },
                  ],
                })
              }
            >
              添加选项
            </Button>
          )}
        </div>
      ) : q.type === "rating" ? (
        <div className="rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n}>
              <input type="radio" name={q.id} />
              {n}
            </label>
          ))}
        </div>
      ) : q.type === "textarea" ? (
        <textarea
          placeholder="多行文本回答预览（不收集答案）"
          aria-label={q.title}
        />
      ) : (
        <input
          className="answer-input"
          placeholder="文本回答预览（不收集答案）"
          aria-label={q.title}
        />
      )}
    </article>
  );
}
