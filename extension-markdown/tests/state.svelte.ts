/** A reactive cell, for a spec that changes a prop between renders. */
export const cell = <T>(initial: T) => {
  let value = $state.raw(initial);

  return {
    get value() {
      return value;
    },
    set value(next: T) {
      value = next;
    },
  };
};
