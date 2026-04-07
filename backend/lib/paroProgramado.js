function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function isEquipmentFaultCategory(categoria) {
  const normalizedCategory = normalizeText(categoria);
  return normalizedCategory === 'equipment fault' || normalizedCategory === 'fallo';
}

function isScheduledDescription(descripcionModoFalla) {
  const normalizedDescription = normalizeText(descripcionModoFalla);
  return normalizedDescription.includes('scheduled stop')
    || normalizedDescription.includes('paro programado');
}

function resolveParoProgramado(categoria, descripcionModoFalla) {
  if (isEquipmentFaultCategory(categoria)) {
    return 'No';
  }

  if (isScheduledDescription(descripcionModoFalla)) {
    return 'Si';
  }

  return 'Si';
}

module.exports = {
  resolveParoProgramado,
};