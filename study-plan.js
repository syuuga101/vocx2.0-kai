/* Dates transcribed from the supplied 2026 EEW3 test schedule; all deadlines are JST. */
(() => {
  'use strict';
  const schedule=[
    [19,'2026-10-20T10:56:00+09:00'],
    [20,'2026-10-27T10:56:00+09:00'],
    [21,'2026-11-03T11:53:00+09:00'],
    [22,'2026-11-10T10:56:00+09:00'],
    [23,'2026-11-12T10:56:00+09:00'],
    [24,'2026-11-17T10:56:00+09:00'],
    [25,'2026-11-24T10:56:00+09:00'],
    [26,'2026-12-01T10:56:00+09:00'],
    [27,'2026-12-08T22:56:00+09:00'],
    [28,'2026-12-15T10:56:00+09:00'],
    [29,'2026-12-22T10:56:00+09:00']
  ].map(([start,deadline])=>Object.freeze({id:start+'-'+(start+1),start,end:start+1,deadline,date:deadline.slice(0,10),label:Number(deadline.slice(5,7))+'/'+Number(deadline.slice(8,10))}));
  function upcoming(now=Date.now()) {
    const time=Number(now);
    return Number.isFinite(time)?schedule.find(exam=>Date.parse(exam.deadline)>=time) || null:null;
  }
  window.StudyPlan={schedule:Object.freeze(schedule),upcoming};
})();
