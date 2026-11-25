import { useState } from "react";
import type { Profile } from "@/lib/training";
import { Modal } from "./Modal";

export function Settings({
  profile,
  onSave,
  onClose,
}: {
  profile: Profile;
  onSave: (profile: Profile) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(profile);
  function change<K extends keyof Profile>(key: K, value: Profile[K]) {
    setDraft({ ...draft, [key]: value });
  }
  return (
    <Modal title="Make it yours" onClose={onClose}>
      <form
        className="settings-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(draft);
        }}
      >
        <label>
          Your name
          <input
            required
            maxLength={50}
            value={draft.name}
            onChange={(event) => change("name", event.target.value)}
          />
        </label>
        <div className="form-grid">
          <label>
            Session length
            <select
              value={draft.minutes}
              onChange={(event) =>
                change("minutes", Number(event.target.value))
              }
            >
              <option value={35}>35 minutes</option>
              <option value={40}>40 minutes</option>
              <option value={45}>45 minutes</option>
            </select>
          </label>
          <label>
            Default location
            <select
              value={draft.location}
              onChange={(event) =>
                change("location", event.target.value as Profile["location"])
              }
            >
              <option>Home</option>
              <option>Gym</option>
            </select>
          </label>
        </div>
        <label>
          Weight units
          <select
            value={draft.units}
            onChange={(event) =>
              change("units", event.target.value as Profile["units"])
            }
          >
            <option value="lb">Pounds (lb)</option>
            <option value="kg">Kilograms (kg)</option>
          </select>
        </label>
        <p className="field-help">
          Existing logs keep their original units. New sessions use this
          selection.
        </p>
        <label>
          My goal
          <textarea
            maxLength={1000}
            value={draft.goal}
            onChange={(event) => change("goal", event.target.value)}
          />
        </label>
        <label>
          Available equipment
          <textarea
            maxLength={1500}
            value={draft.equipment}
            onChange={(event) => change("equipment", event.target.value)}
          />
        </label>
        <p className="field-help">
          Include dumbbell range and bar type when known. List home and gym
          equipment separately.
        </p>
        <label>
          Movements to avoid or other limitations
          <textarea
            maxLength={1500}
            placeholder="Optional — share what your program should accommodate"
            value={draft.limitations}
            onChange={(event) => change("limitations", event.target.value)}
          />
        </label>
        <p className="field-help">
          These preferences apply to new drafts. Your current plan stays intact.
        </p>
        <button className="primary full" type="submit">
          Save preferences
        </button>
      </form>
    </Modal>
  );
}
