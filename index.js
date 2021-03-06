const { validate: isemail } = require("isemail");
const { DateTime } = require("luxon");
const R = require("ramda");

// re-export compose, since you *need* it to use this library
exports.compose = R.compose;

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;

    // add the stack to the error on both browsers and node
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = new Error(message).stack;
    }
  }

  fieldName(field) {
    this.field = field;
    return this;
  }

  fieldValue(value) {
    this.value = value;
    return this;
  }
}

exports.ValidationError = ValidationError;

exports.date = value => {
  // reject values that aren't strings or dates
  if (typeof value !== "string" && !(value instanceof Date)) {
    throw new ValidationError("is not a valid date").fieldValue(value);
  }

  // only parse the value if it's not already a date object
  const dateTime =
    value instanceof Date
      ? DateTime.fromJSDate(value)
      : DateTime.fromISO(value, {
          setZone: true
        });

  if (dateTime.invalidReason != null) {
    throw new ValidationError(
      `is not a valid date: ${dateTime.invalidReason}`
    ).fieldValue(value);
  } else {
    return dateTime.toFormat("yyyy-MM-dd");
  }
};

exports.timestamp = timestampString => {
  // pass through the timestamp if it's already a Date object
  if (timestampString instanceof Date) {
    return timestampString;
  }

  // reject values that aren't strings
  if (typeof timestampString !== "string") {
    throw new ValidationError("is not a valid timestamp").fieldValue(
      timestampString
    );
  }

  const dateTime = DateTime.fromISO(timestampString, {
    setZone: true
  });

  if (dateTime.invalidReason != null) {
    throw new ValidationError(
      `is not a valid timestamp: ${dateTime.invalidReason}`
    ).fieldValue(timestampString);
  } else {
    return dateTime.toJSDate();
  }
};

exports.int = string => {
  const value = parseInt(string, 10);
  if (isNaN(value)) {
    throw new ValidationError("is not a valid integer").fieldValue(string);
  } else {
    return value;
  }
};

exports.float = string => {
  const value = parseFloat(string);
  if (isNaN(value)) {
    throw new ValidationError("is not a valid decimal").fieldValue(string);
  } else {
    return value;
  }
};

// inclusive
exports.min = (min, message = "is too small") => value => {
  if (min > value) {
    throw new ValidationError(message).fieldValue(value);
  } else {
    return value;
  }
};

// inclusive
exports.max = (max, message = "is too large") => value => {
  if (value > max) {
    throw new ValidationError(message).fieldValue(value);
  } else {
    return value;
  }
};

// inclusive
exports.range = (min, max, message = `is not between ${min} and ${max}`) =>
  R.compose(
    exports.max(max, message),
    exports.min(min, message)
  );

exports.string = value => {
  if (typeof value !== "string") {
    throw new ValidationError("is not a string").fieldValue(value);
  } else {
    return value;
  }
};

// inclusive
exports.minLength = (minLength, message = "is too short") => value => {
  if (minLength > value.length) {
    throw new ValidationError(message).fieldValue(value);
  } else {
    return value;
  }
};

// inclusive
exports.maxLength = (maxLength, message = "is too long") => value => {
  if (value.length > maxLength) {
    throw new ValidationError(message).fieldValue(value);
  } else {
    return value;
  }
};

// inclusive
exports.lengthRange = (min, max, message) =>
  R.compose(
    exports.maxLength(max, message),
    exports.minLength(min, message)
  );

exports.notBlank = string => {
  if (string.trim() === "") {
    throw new ValidationError("is blank").fieldValue(string);
  } else {
    return string;
  }
};

exports.trim = string => string.trim();

exports.email = string => {
  if (!isemail(string)) {
    throw new ValidationError("is not a valid email").fieldValue(string);
  } else {
    return string;
  }
};

exports.object = value => {
  if (typeof value !== "object") {
    throw new ValidationError("is not an object").fieldValue(value);
  } else {
    return value;
  }
};

exports.required = value => {
  if (value == null) {
    throw new ValidationError("is required").fieldValue(value);
  } else {
    return value;
  }
};

exports.fields = (
  requiredKeyValidations,
  optionalKeyValidations = {}
) => object =>
  R.merge(
    R.compose(
      R.fromPairs,
      R.map(([key, validate]) => {
        try {
          return [key, validate(object[key])];
        } catch (err) {
          err instanceof ValidationError && err.fieldName(key);
          throw err;
        }
      }),
      R.filter(([key]) => object[key] != null),
      R.toPairs
    )(optionalKeyValidations),
    R.mapObjIndexed((validate, key) => {
      if (object[key] == null) {
        throw new ValidationError("is required").fieldName(key);
      } else {
        try {
          return validate(object[key]);
        } catch (err) {
          err instanceof ValidationError && err.fieldName(key);
          throw err;
        }
      }
    }, requiredKeyValidations)
  );
