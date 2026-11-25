import { days, type Plan } from "@/lib/training";

export function PlanDraft({ plan }: { plan: Plan }) {
  return (
    <>
      <p>{plan.summary}</p>
      <div className="draft-list">
        {plan.days.map((workout, index) => (
          <details key={index}>
            <summary>
              <strong>{days[index]}</strong>
              <span>{workout.title}</span>
              <small>
                {workout.minutes ? `${workout.minutes} min` : "Rest"}
              </small>
            </summary>
            <p className="field-help">
              {workout.focus} · {workout.location}
            </p>
            <ul>
              {workout.exercises.map((exercise, exerciseIndex) => (
                <li key={exerciseIndex}>
                  <strong>{exercise.name}</strong> · {exercise.sets} ×{" "}
                  {exercise.target} {exercise.unit} · {exercise.rest}s rest
                  {exercise.note && (
                    <p className="field-help">{exercise.note}</p>
                  )}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </>
  );
}
