const mongoose = require('mongoose');

const kitSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  caseId: {
    type: String,
    default: null
  },
  title: {
    type: String,
    required: true
  },
  company: {
    type: String,
    required: true
  },
  kitData: {
    type: Object,
    required: true
  },
  pinnedState: {
    type: Object,
    default: {
      editedQuestionIds: [],
      customQuestionIds: [],
      editedFlashcardIds: [],
      customFlashcardIds: [],
      briefPinned: false
    }
  },
  practiceState: {
    type: Object,
    default: {
      cardConfidences: {}, // { f1: 'easy' | 'medium' | 'hard' }
      lastPracticedAt: null
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

kitSchema.pre('save', function() {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('Kit', kitSchema);
